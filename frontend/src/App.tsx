import { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Layout } from "./components/Layout";
import { HomePage } from "./pages/HomePage";
import { GraphPage } from "./pages/GraphPage";
import { PapersPage } from "./pages/PapersPage";
import { ChatPage } from "./pages/ChatPage";
import { LearningPathPage } from "./pages/LearningPathPage";
import { SettingsPage } from "./pages/SettingsPage";
import { QuizPage } from "./pages/QuizPage";
import { useGraphStore } from "./stores/graphStore";
import { usePaperStore } from "./stores/paperStore";
import "./App.css";

const queryClient = new QueryClient();

function App() {
  const loadFromServer = useGraphStore((s) => s.loadFromServer);
  const concepts = useGraphStore((s) => s.concepts);
  const loadPapersFromServer = usePaperStore((s) => s.loadPapersFromServer);
  const papers = usePaperStore((s) => s.papers);

  // 起動時にFirestoreからデータを読み込み（ローカルにデータがない場合）
  useEffect(() => {
    if (concepts.length === 0) {
      loadFromServer().catch(() => {});
    }
    if (papers.length === 0) {
      loadPapersFromServer().catch(() => {});
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="graph" element={<GraphPage />} />
            <Route path="papers" element={<PapersPage />} />
            <Route path="chat" element={<ChatPage />} />
            <Route path="learning" element={<LearningPathPage />} />
            <Route path="quiz" element={<QuizPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
