import { useState } from "react";
import { useGraphStore, CONCEPT_TYPE_COLORS, CONCEPT_TYPE_LABELS, type ConceptType } from "../stores/graphStore";
import {
  runAgent,
  type AgentActivity,
  type QuizQuestion,
} from "../api/client";
import { AgentActivityPanel } from "../components/AgentActivity";

export function QuizPage() {
  const { concepts } = useGraphStore();
  const [isLoading, setIsLoading] = useState(false);
  const [activities, setActivities] = useState<AgentActivity[]>([]);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const [difficulty, setDifficulty] = useState<"easy" | "intermediate" | "hard">("intermediate");
  const [selectedConceptIds, setSelectedConceptIds] = useState<Set<string>>(new Set(concepts.map(c => c.id)));

  const toggleConcept = (id: string) => {
    setSelectedConceptIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedConceptIds(new Set(concepts.map(c => c.id)));
  const deselectAll = () => setSelectedConceptIds(new Set());

  const selectedConcepts = concepts.filter(c => selectedConceptIds.has(c.id));

  const handleGenerate = async () => {
    if (selectedConcepts.length === 0) return;

    setIsLoading(true);
    setQuestions([]);
    setCurrentQuestion(0);
    setScore(0);
    setShowResult(false);

    try {
      const response = await runAgent("quiz", "", selectedConcepts, { difficulty });
      setActivities(response.activities);

      const quizResult = response.result as { questions?: QuizQuestion[] };
      if (quizResult.questions) {
        setQuestions(quizResult.questions);
      }
    } catch (error) {
      console.error("Failed to generate quiz:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnswer = (answerIndex: number) => {
    if (selectedAnswer !== null) return;

    setSelectedAnswer(answerIndex);
    if (answerIndex === questions[currentQuestion].correct) {
      setScore((prev) => prev + 1);
    }
  };

  const handleNext = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion((prev) => prev + 1);
      setSelectedAnswer(null);
    } else {
      setShowResult(true);
    }
  };

  const handleRetry = () => {
    setQuestions([]);
    setCurrentQuestion(0);
    setSelectedAnswer(null);
    setShowResult(false);
    setScore(0);
    setActivities([]);
  };

  const question = questions[currentQuestion];

  return (
    <div className="quiz-page page-container">
      <div className="quiz-header">
        <h2>理解度クイズ</h2>
        <p className="subtitle">概念の理解度をチェックしましょう</p>
      </div>

      {concepts.length === 0 ? (
        <div className="empty-state">
          <p>まだ概念が登録されていません</p>
          <p className="hint">
            ホームページから論文をアップロードして概念を抽出してください
          </p>
        </div>
      ) : questions.length === 0 && !isLoading ? (
        <div className="quiz-start">
          <div className="concept-selector">
            <div className="concept-selector-header">
              <span className="concept-selector-title">
                クイズ対象の概念（{selectedConcepts.length}/{concepts.length}）
              </span>
              <div className="concept-selector-actions">
                <button className="select-action-btn" onClick={selectAll}>すべて選択</button>
                <button className="select-action-btn" onClick={deselectAll}>すべて解除</button>
              </div>
            </div>
            <div className="concept-chip-list">
              {concepts.map(c => (
                <button
                  key={c.id}
                  className={`concept-chip ${selectedConceptIds.has(c.id) ? "selected" : ""}`}
                  onClick={() => toggleConcept(c.id)}
                  style={{
                    borderColor: selectedConceptIds.has(c.id)
                      ? CONCEPT_TYPE_COLORS[(c.concept_type as ConceptType) || "concept"]
                      : undefined,
                  }}
                >
                  <span
                    className="concept-chip-dot"
                    style={{ background: CONCEPT_TYPE_COLORS[(c.concept_type as ConceptType) || "concept"] }}
                  />
                  <span className="concept-chip-name">{c.name_ja || c.name}</span>
                  <span className="concept-chip-type">
                    {CONCEPT_TYPE_LABELS[(c.concept_type as ConceptType) || "concept"]}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="difficulty-selector">
            <span className="difficulty-label">難易度</span>
            <div className="difficulty-buttons">
              <button
                className={`difficulty-btn ${difficulty === "easy" ? "active" : ""}`}
                onClick={() => setDifficulty("easy")}
              >
                かんたん
              </button>
              <button
                className={`difficulty-btn ${difficulty === "intermediate" ? "active" : ""}`}
                onClick={() => setDifficulty("intermediate")}
              >
                ふつう
              </button>
              <button
                className={`difficulty-btn ${difficulty === "hard" ? "active" : ""}`}
                onClick={() => setDifficulty("hard")}
              >
                むずかしい
              </button>
            </div>
          </div>
          <button
            onClick={handleGenerate}
            disabled={isLoading || selectedConcepts.length === 0}
            className="generate-btn"
          >
            {selectedConcepts.length === 0
              ? "概念を選択してください"
              : `${selectedConcepts.length}個の概念からクイズを生成`}
          </button>
          <AgentActivityPanel activities={activities} />
        </div>
      ) : isLoading ? (
        <div className="quiz-loading">
          <div className="loading-spinner" />
          <p>クイズを生成中...</p>
          <AgentActivityPanel activities={activities} />
        </div>
      ) : showResult ? (
        <div className="quiz-result">
          <div className="result-card">
            <h3>結果</h3>
            <div className="score">
              <span className="score-value">{score}</span>
              <span className="score-total">/ {questions.length}</span>
            </div>
            <p className="score-message">
              {score === questions.length
                ? "完璧です！素晴らしい理解度です。"
                : score >= questions.length / 2
                  ? "良い調子です！もう少しで完璧です。"
                  : "復習が必要かもしれません。頑張りましょう！"}
            </p>
            <button onClick={handleRetry} className="retry-btn">
              もう一度挑戦
            </button>
          </div>
        </div>
      ) : (
        <div className="quiz-question">
          <div className="question-header">
            <span className="question-number">
              問題 {currentQuestion + 1} / {questions.length}
            </span>
            <span className="current-score">スコア: {score}</span>
          </div>
          <div className="question-card">
            <h3>{question.question}</h3>
            <div className="options">
              {question.options.map((option, index) => (
                <button
                  key={index}
                  className={`option-btn ${
                    selectedAnswer !== null
                      ? index === question.correct
                        ? "correct"
                        : index === selectedAnswer
                          ? "incorrect"
                          : ""
                      : ""
                  }`}
                  onClick={() => handleAnswer(index)}
                  disabled={selectedAnswer !== null}
                >
                  <span className="option-label">
                    {String.fromCharCode(65 + index)}
                  </span>
                  <span className="option-text">{option}</span>
                </button>
              ))}
            </div>
            {selectedAnswer !== null && (
              <button onClick={handleNext} className="next-btn">
                {currentQuestion < questions.length - 1 ? "次の問題" : "結果を見る"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
