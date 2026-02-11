import { useState } from "react";
import { useGraphStore } from "../stores/graphStore";
import { useLearningPathStore } from "../stores/learningPathStore";
import {
  generateLearningPath,
  type LearningStep,
} from "../api/client";

export function LearningPathPage() {
  const { concepts, relations } = useGraphStore();
  const {
    paths,
    activePathId,
    savePath,
    deletePath,
    setActivePath,
    toggleStepComplete,
  } = useLearningPathStore();
  const [isLoading, setIsLoading] = useState(false);

  const activePath = paths.find((p) => p.id === activePathId);

  const handleGenerate = async () => {
    if (concepts.length === 0) return;

    setIsLoading(true);
    try {
      const result = await generateLearningPath(concepts, relations);
      savePath(result.steps, result.summary);
    } catch (error) {
      console.error("Failed to generate learning path:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const progress = activePath
    ? Math.round(
        (activePath.completedSteps.length / activePath.steps.length) * 100
      )
    : 0;

  return (
    <div className="learning-path-page page-container">
      <div className="learning-path-header">
        <h2>学習パス</h2>
        <p className="subtitle">最適な順序で概念を学習しましょう</p>
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

          {paths.length > 1 && (
            <div className="saved-paths-section">
              <h4>保存済み学習パス ({paths.length})</h4>
              <div className="saved-paths-list">
                {paths.map((p) => (
                  <div
                    key={p.id}
                    className={`saved-path-item ${
                      p.id === activePathId ? "active" : ""
                    }`}
                    onClick={() => setActivePath(p.id)}
                  >
                    <div className="saved-path-info">
                      <span className="saved-path-date">
                        {new Date(p.createdAt).toLocaleDateString("ja-JP", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <span className="saved-path-steps">
                        {p.completedSteps.length}/{p.steps.length} 完了
                      </span>
                    </div>
                    <button
                      className="delete-path-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        deletePath(p.id);
                      }}
                      title="削除"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activePath && (
            <>
              <div className="progress-section">
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="progress-text">
                  {activePath.completedSteps.length} /{" "}
                  {activePath.steps.length} 完了 ({progress}%)
                </span>
              </div>

              <div className="summary-section">
                <p>{activePath.summary}</p>
              </div>

              <div className="steps-list">
                {activePath.steps.map((step: LearningStep) => (
                  <div
                    key={step.order}
                    className={`step-card ${
                      activePath.completedSteps.includes(step.order)
                        ? "completed"
                        : ""
                    }`}
                    onClick={() =>
                      toggleStepComplete(activePath.id, step.order)
                    }
                  >
                    <div className="step-header">
                      <span className="step-number">{step.order}</span>
                      <h3 className="step-name">{step.concept_name}</h3>
                      <span className="step-checkbox">
                        {activePath.completedSteps.includes(step.order)
                          ? "✓"
                          : "○"}
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
