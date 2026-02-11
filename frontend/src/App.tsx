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
import "./App.css";

const queryClient = new QueryClient();

function App() {
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
