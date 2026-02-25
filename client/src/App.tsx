import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import PresenterView from "./pages/PresenterView";
import JoinPage from "./pages/JoinPage";
import ParticipantView from "./pages/ParticipantView";
import ResultsView from "./pages/ResultsView";

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/present/:roomCode" element={<PresenterView />} />
        <Route path="/join" element={<JoinPage />} />
        <Route path="/participate/:roomCode" element={<ParticipantView />} />
        <Route path="/results/:id" element={<ResultsView />} />
      </Routes>
    </div>
  );
}
