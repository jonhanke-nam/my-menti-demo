import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSessionStore } from "../store/sessionStore";
import type { Presentation, Question } from "../store/sessionStore";

const API_URL = import.meta.env.VITE_API_URL || "";

export default function Dashboard() {
  const navigate = useNavigate();
  const { token, setToken, presentations, setPresentations } = useSessionStore();
  const [newTitle, setNewTitle] = useState("");
  const [editingPres, setEditingPres] = useState<Presentation | null>(null);
  const [showQuestionForm, setShowQuestionForm] = useState<number | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<number | null>(null);
  const [questionForm, setQuestionForm] = useState({
    type: "multiple_choice" as Question["type"],
    prompt: "",
    options: ["", ""],
  });
  const [loading, setLoading] = useState(true);

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  useEffect(() => {
    if (!token) {
      navigate("/");
      return;
    }
    fetchPresentations();
  }, [token, navigate]);

  const fetchPresentations = async () => {
    try {
      const res = await fetch(`${API_URL}/api/presentations`, { headers });
      if (res.status === 401) {
        setToken(null);
        navigate("/");
        return;
      }
      const data = await res.json();
      setPresentations(data);
    } catch (err) {
      console.error("Failed to fetch presentations:", err);
    } finally {
      setLoading(false);
    }
  };

  const createPresentation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const res = await fetch(`${API_URL}/api/presentations`, {
      method: "POST",
      headers,
      body: JSON.stringify({ title: newTitle.trim() }),
    });
    if (res.ok) {
      setNewTitle("");
      fetchPresentations();
    }
  };

  const deletePresentation = async (id: number) => {
    if (!window.confirm("Delete this presentation and all its questions? This cannot be undone.")) return;
    await fetch(`${API_URL}/api/presentations/${id}`, {
      method: "DELETE",
      headers,
    });
    fetchPresentations();
  };

  const activatePresentation = async (id: number) => {
    const res = await fetch(`${API_URL}/api/presentations/${id}/activate`, {
      method: "POST",
      headers,
    });
    if (res.ok) {
      const data = await res.json();
      navigate(`/present/${data.roomCode}`);
    }
  };

  const loadQuestions = async (presId: number) => {
    const res = await fetch(`${API_URL}/api/presentations/${presId}`, { headers });
    if (res.ok) {
      const data = await res.json();
      setEditingPres(data);
    }
  };

  const addQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showQuestionForm || !questionForm.prompt.trim()) return;

    const body: Record<string, unknown> = {
      presentationId: showQuestionForm,
      type: questionForm.type,
      prompt: questionForm.prompt.trim(),
    };

    if (questionForm.type === "multiple_choice") {
      const validOptions = questionForm.options.filter((o) => o.trim());
      if (validOptions.length < 2) return;
      body.options = validOptions;
    }

    const res = await fetch(`${API_URL}/api/questions`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (res.ok) {
      setQuestionForm({ type: "multiple_choice", prompt: "", options: ["", ""] });
      setShowQuestionForm(null);
      if (editingPres) loadQuestions(editingPres.id);
    }
  };

  const startEditingQuestion = (q: Question) => {
    setEditingQuestion(q.id);
    setShowQuestionForm(null);
    const parsedOptions: string[] = q.options ? JSON.parse(q.options) : ["", ""];
    setQuestionForm({
      type: q.type,
      prompt: q.prompt,
      options: parsedOptions.length >= 2 ? parsedOptions : [...parsedOptions, ...Array(2 - parsedOptions.length).fill("")],
    });
  };

  const cancelEditing = () => {
    setEditingQuestion(null);
    setQuestionForm({ type: "multiple_choice", prompt: "", options: ["", ""] });
  };

  const saveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQuestion || !questionForm.prompt.trim()) return;

    const body: Record<string, unknown> = {
      type: questionForm.type,
      prompt: questionForm.prompt.trim(),
    };

    if (questionForm.type === "multiple_choice") {
      const validOptions = questionForm.options.filter((o) => o.trim());
      if (validOptions.length < 2) return;
      body.options = validOptions;
    } else {
      body.options = null;
    }

    const res = await fetch(`${API_URL}/api/questions/${editingQuestion}`, {
      method: "PUT",
      headers,
      body: JSON.stringify(body),
    });

    if (res.ok) {
      cancelEditing();
      if (editingPres) loadQuestions(editingPres.id);
    }
  };

  const deleteQuestion = async (qId: number) => {
    if (!window.confirm("Delete this question?")) return;
    await fetch(`${API_URL}/api/questions/${qId}`, {
      method: "DELETE",
      headers,
    });
    if (editingPres) loadQuestions(editingPres.id);
  };

  const logout = () => {
    setToken(null);
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">My Presentations</h1>
        <button
          onClick={logout}
          className="text-gray-500 hover:text-gray-700 text-sm"
        >
          Log out
        </button>
      </header>

      <div className="max-w-3xl mx-auto p-6">
        {/* Create new presentation */}
        <form onSubmit={createPresentation} className="flex gap-3 mb-8">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="New presentation title..."
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
          <button
            type="submit"
            disabled={!newTitle.trim()}
            className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            Create
          </button>
        </form>

        {/* Presentations list */}
        {presentations.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p className="text-lg">No presentations yet</p>
            <p className="text-sm mt-1">Create one above to get started</p>
          </div>
        ) : (
          <div className="space-y-4">
            {presentations.map((pres) => (
              <div
                key={pres.id}
                className="bg-white rounded-xl border border-gray-200 p-5"
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-gray-800">
                    {pres.title}
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => loadQuestions(pres.id)}
                      className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => activatePresentation(pres.id)}
                      className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                    >
                      Go Live
                    </button>
                    <button
                      onClick={() => deletePresentation(pres.id)}
                      className="px-3 py-1.5 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {pres.roomCode && pres.isActive === 1 && (
                  <p className="text-sm text-green-600">
                    Active — Room: <span className="font-mono font-bold">{pres.roomCode}</span>
                  </p>
                )}

                {/* Expanded question editor */}
                {editingPres?.id === pres.id && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <h4 className="font-medium text-gray-700 mb-3">Questions</h4>

                    {editingPres.questions && editingPres.questions.length > 0 ? (
                      <div className="space-y-3 mb-4">
                        {editingPres.questions.map((q, i) => (
                          <div key={q.id}>
                            {editingQuestion === q.id ? (
                              /* Inline edit form */
                              <form onSubmit={saveQuestion} className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-sm font-medium text-blue-700">Editing question {i + 1}</span>
                                </div>
                                <select
                                  value={questionForm.type}
                                  onChange={(e) =>
                                    setQuestionForm({
                                      ...questionForm,
                                      type: e.target.value as Question["type"],
                                    })
                                  }
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none"
                                >
                                  <option value="multiple_choice">Multiple Choice</option>
                                  <option value="word_cloud">Word Cloud</option>
                                  <option value="open_text">Open Text</option>
                                </select>

                                <input
                                  type="text"
                                  value={questionForm.prompt}
                                  onChange={(e) =>
                                    setQuestionForm({ ...questionForm, prompt: e.target.value })
                                  }
                                  placeholder="Question prompt..."
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none"
                                  autoFocus
                                />

                                {questionForm.type === "multiple_choice" && (
                                  <div className="space-y-2">
                                    {questionForm.options.map((opt, optIdx) => (
                                      <div key={optIdx} className="flex gap-2">
                                        <input
                                          type="text"
                                          value={opt}
                                          onChange={(e) => {
                                            const opts = [...questionForm.options];
                                            opts[optIdx] = e.target.value;
                                            setQuestionForm({ ...questionForm, options: opts });
                                          }}
                                          placeholder={`Option ${optIdx + 1}`}
                                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg outline-none"
                                        />
                                        {questionForm.options.length > 2 && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const opts = questionForm.options.filter((_, idx) => idx !== optIdx);
                                              setQuestionForm({ ...questionForm, options: opts });
                                            }}
                                            className="text-red-400 hover:text-red-600 text-sm px-2"
                                          >
                                            X
                                          </button>
                                        )}
                                      </div>
                                    ))}
                                    {questionForm.options.length < 6 && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setQuestionForm({
                                            ...questionForm,
                                            options: [...questionForm.options, ""],
                                          })
                                        }
                                        className="inline-flex items-center gap-1 text-blue-600 text-sm hover:text-blue-700 font-medium mt-1"
                                      >
                                        + Add option
                                      </button>
                                    )}
                                  </div>
                                )}

                                <div className="flex gap-2">
                                  <button
                                    type="submit"
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
                                  >
                                    Save
                                  </button>
                                  <button
                                    type="button"
                                    onClick={cancelEditing}
                                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition text-sm"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </form>
                            ) : (
                              /* Read-only question row */
                              <div className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-2">
                                <div>
                                  <span className="text-gray-400 text-sm mr-2">
                                    {i + 1}.
                                  </span>
                                  <span className="text-gray-700">{q.prompt}</span>
                                  <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                                    {q.type.replace("_", " ")}
                                  </span>
                                  {q.type === "multiple_choice" && q.options && (
                                    <span className="ml-2 text-xs text-gray-400">
                                      ({JSON.parse(q.options).join(", ")})
                                    </span>
                                  )}
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => startEditingQuestion(q)}
                                    className="text-blue-500 hover:text-blue-700 text-sm"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => deleteQuestion(q.id)}
                                    className="text-red-400 hover:text-red-600 text-sm"
                                  >
                                    Remove
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-400 text-sm mb-4">
                        No questions yet
                      </p>
                    )}

                    {showQuestionForm === pres.id ? (
                      <form onSubmit={addQuestion} className="bg-gray-50 rounded-lg p-4 space-y-3">
                        <select
                          value={questionForm.type}
                          onChange={(e) =>
                            setQuestionForm({
                              ...questionForm,
                              type: e.target.value as Question["type"],
                            })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none"
                        >
                          <option value="multiple_choice">Multiple Choice</option>
                          <option value="word_cloud">Word Cloud</option>
                          <option value="open_text">Open Text</option>
                        </select>

                        <input
                          type="text"
                          value={questionForm.prompt}
                          onChange={(e) =>
                            setQuestionForm({ ...questionForm, prompt: e.target.value })
                          }
                          placeholder="Question prompt..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none"
                        />

                        {questionForm.type === "multiple_choice" && (
                          <div className="space-y-2">
                            {questionForm.options.map((opt, i) => (
                              <input
                                key={i}
                                type="text"
                                value={opt}
                                onChange={(e) => {
                                  const opts = [...questionForm.options];
                                  opts[i] = e.target.value;
                                  setQuestionForm({ ...questionForm, options: opts });
                                }}
                                placeholder={`Option ${i + 1}`}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none"
                              />
                            ))}
                            {questionForm.options.length < 6 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setQuestionForm({
                                    ...questionForm,
                                    options: [...questionForm.options, ""],
                                  })
                                }
                                className="inline-flex items-center gap-1 text-blue-600 text-sm hover:text-blue-700 font-medium mt-1"
                              >
                                + Add option
                              </button>
                            )}
                          </div>
                        )}

                        <div className="flex gap-2">
                          <button
                            type="submit"
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
                          >
                            Add Question
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowQuestionForm(null)}
                            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition text-sm"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : (
                      <button
                        onClick={() => setShowQuestionForm(pres.id)}
                        className="text-blue-600 text-sm hover:text-blue-700 font-medium"
                      >
                        + Add question
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
