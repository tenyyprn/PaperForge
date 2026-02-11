import { useState } from "react";
import { useGraphStore } from "../stores/graphStore";
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

  const handleGenerate = async () => {
    if (concepts.length === 0) return;

    setIsLoading(true);
    setQuestions([]);
    setCurrentQuestion(0);
    setScore(0);
    setShowResult(false);

    try {
      const response = await runAgent("quiz", "", concepts);
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
          <div className="concept-info">
            <span className="concept-count">{concepts.length}</span>
            <span>個の概念からクイズを生成します</span>
          </div>
          <button
            onClick={handleGenerate}
            disabled={isLoading}
            className="generate-btn"
          >
            クイズを生成
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
