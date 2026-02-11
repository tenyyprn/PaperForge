import { useState } from "react";
import { useGraphStore } from "../stores/graphStore";
import {
  generateLearningPath,
  type LearningStep,
  type LearningPathResponse,
} from "../api/client";

export function LearningPathPage() {
  const { concepts, relations } = useGraphStore();
  const [isLoading, setIsLoading] = useState(false);
  const [learningPath, setLearningPath] = useState<LearningPathResponse | null>(
    null
  );
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  const handleGenerate = async () => {
    if (concepts.length === 0) return;

    setIsLoading(true);
    try {
      const result = await generateLearningPath(concepts, relations);
      setLearningPath(result);
      setCompletedSteps(new Set());
    } catch (error) {
      console.error("Failed to generate learning path:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleStepComplete = (order: number) => {
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(order)) {
        next.delete(order);
      } else {
        next.add(order);
      }
      return next;
    });
  };

  const progress = learningPath
    ? Math.round((completedSteps.size / learningPath.steps.length) * 100)
    : 0;

  return (
    <div className="learning-path-page page-container">
      <div className="learning-path-header">
        <h2>学習パス</h2>
        <p className="subtitle">
          最適な順序で概念を学習しましょう
        </p>
      </div>

      {concepts.length === 0 ? (
        <div className="empty-state">
          <p>まだ概念が登録されていません</p>
          <p className="hint">
            ホームページから論文をアップロードして概念を抽出してください
          </p>
        </div>
      ) : (
        <div className="learning-path-content">
          <div className="generate-section">
            <div className="concept-count">
              登録済み概念: {concepts.length}件
            </div>
            <button
              onClick={handleGenerate}
              disabled={isLoading}
              className="generate-btn"
            >
              {isLoading ? "生成中..." : "学習パスを生成"}
            </button>
          </div>

          {learningPath && (
            <>
              <div className="progress-section">
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="progress-text">
                  {completedSteps.size} / {learningPath.steps.length} 完了
                  ({progress}%)
                </span>
              </div>

              <div className="summary-section">
                <p>{learningPath.summary}</p>
              </div>

              <div className="steps-list">
                {learningPath.steps.map((step: LearningStep) => (
                  <div
                    key={step.order}
                    className={`step-card ${
                      completedSteps.has(step.order) ? "completed" : ""
                    }`}
                    onClick={() => toggleStepComplete(step.order)}
                  >
                    <div className="step-header">
                      <span className="step-number">{step.order}</span>
                      <h3 className="step-name">{step.concept_name}</h3>
                      <span className="step-checkbox">
                        {completedSteps.has(step.order) ? "✓" : "○"}
                      </span>
                    </div>
                    <p className="step-reason">{step.reason}</p>
                    {step.prerequisites.length > 0 && (
                      <div className="prerequisites">
                        <span className="prereq-label">前提知識:</span>
                        {step.prerequisites.map((prereq, i) => (
                          <span key={i} className="prereq-tag">
                            {prereq}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
