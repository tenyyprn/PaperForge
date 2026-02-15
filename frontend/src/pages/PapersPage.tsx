import { useState, useMemo, useCallback } from "react";
import { usePaperStore, type Paper } from "../stores/paperStore";
import { useGraphStore, CONCEPT_TYPE_COLORS, CONCEPT_TYPE_LABELS, type ConceptType } from "../stores/graphStore";
import { sendChatMessage, type ChatMessage, type ChatConcept } from "../api/client";

type CompareView = "cards" | "table" | "ai";
type ExplanationLevel = "middle_school" | "high_school" | "university" | "researcher";

export function PapersPage() {
  const { papers, removePaper, clearPapers } = usePaperStore();
  const { concepts } = useGraphStore();
  const [selectedPaper, setSelectedPaper] = useState<Paper | null>(null);
  const [expandedPaperId, setExpandedPaperId] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<Set<string>>(new Set());
  const [compareMode, setCompareMode] = useState(false);
  const [compareView, setCompareView] = useState<CompareView>("cards");
  const [explanationLevel, setExplanationLevel] = useState<ExplanationLevel>("high_school");

  const handleClearAll = () => {
    if (confirm("すべての論文を削除しますか？\n（ナレッジグラフの概念は削除されません）")) {
      clearPapers();
      setSelectedPaper(null);
    }
  };

  const handleRemovePaper = (paperId: string) => {
    if (confirm("この論文を削除しますか？")) {
      removePaper(paperId);
      if (selectedPaper?.id === paperId) {
        setSelectedPaper(null);
      }
    }
  };

  const getPaperConcepts = (paper: Paper) => {
    return concepts.filter((c) => paper.conceptIds.includes(c.id));
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const toggleCompare = (paperId: string) => {
    setCompareIds((prev) => {
      const next = new Set(prev);
      if (next.has(paperId)) {
        next.delete(paperId);
      } else if (next.size < 3) {
        next.add(paperId);
      }
      return next;
    });
  };

  const comparePapers = useMemo(
    () => papers.filter((p) => compareIds.has(p.id)),
    [papers, compareIds]
  );

  const sharedConceptIds = useMemo(() => {
    if (comparePapers.length < 2) return new Set<string>();
    const sets = comparePapers.map((p) => new Set(p.conceptIds));
    const shared = new Set<string>();
    sets[0].forEach((id) => {
      if (sets.every((s) => s.has(id))) shared.add(id);
    });
    return shared;
  }, [comparePapers]);

  const exitCompareMode = () => {
    setCompareMode(false);
    setCompareIds(new Set());
    setAiAnalysis("");
    setAiLoading(false);
  };

  // AI分析
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const runAiAnalysis = useCallback(async () => {
    if (comparePapers.length < 2) return;
    setAiLoading(true);
    setAiAnalysis("");

    const paperSummaries = comparePapers.map((p, i) => {
      const title = p.summary.title_ja || p.summary.title || p.filename;
      const claim = p.summary.main_claim || "";
      const intro = p.summary.introduction || "";
      const dev = p.summary.development || "";
      const turn = p.summary.turn || "";
      const conclusion = p.summary.conclusion || "";
      const conceptNames = getPaperConcepts(p).map((c) => c.name_ja || c.name).join(", ");
      return `【論文${i + 1}】${title}\n著者: ${p.summary.authors.join(", ") || "不明"} (${p.summary.year || "不明"})\n主張: ${claim}\n起: ${intro}\n承: ${dev}\n転: ${turn}\n結: ${conclusion}\n概念: ${conceptNames}`;
    }).join("\n\n");

    const sharedNames = [...sharedConceptIds]
      .map((id) => {
        const c = concepts.find((x) => x.id === id);
        return c ? c.name_ja || c.name : "";
      })
      .filter(Boolean)
      .join(", ");

    const prompt = `以下の${comparePapers.length}本の論文を比較分析してください。

${paperSummaries}

${sharedNames ? `共通概念: ${sharedNames}` : ""}

以下の観点で詳しく論じてください:
1. **各論文の強み**: それぞれの論文が優れている点
2. **各論文の限界・弱み**: それぞれの改善点や制約
3. **手法の比較**: アプローチの違いと特徴
4. **貢献度の比較**: 学術的・実用的な貢献の違い
5. **引用関係・先行研究の推定**: 論文の発表年や内容から、どの論文がどの論文の先行研究・後続研究にあたるか推定してください。直接引用していると思われる関係、共通の先行研究、技術的な発展の流れを分析してください
6. **時系列の発展**: 年代順に見た場合の研究の発展の流れ。どのような課題が先行研究で提起され、後続の論文でどう解決・発展されたか
7. **相互関係**: 論文間の関係性（補完的か、競合的か、発展的か）
8. **総合評価**: どのような場面でどの論文が有用か

日本語で回答してください。`;

    try {
      const chatConcepts: ChatConcept[] = comparePapers.flatMap((p) =>
        getPaperConcepts(p).map((c) => ({
          name: c.name,
          name_ja: c.name_ja,
          definition: c.definition,
          definition_ja: c.definition_ja,
          concept_type: c.concept_type,
        }))
      );

      const messages: ChatMessage[] = [{ role: "user", content: prompt }];
      const response = await sendChatMessage(messages, chatConcepts);
      setAiAnalysis(response.message.content);
    } catch (error) {
      console.error("AI analysis failed:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes("429") || errorMessage.includes("RESOURCE_EXHAUSTED")) {
        setAiAnalysis("⚠️ APIのレート制限に達しました。\n\n数分待ってから「再分析」ボタンを押してください。\n\n頻繁に発生する場合は、Google CloudコンソールでGemini APIのクォータを確認してください。");
      } else if (errorMessage.includes("Network") || errorMessage.includes("fetch")) {
        setAiAnalysis("⚠️ ネットワークエラーが発生しました。\n\nバックエンドサーバー（port 8001）が起動しているか確認してください。");
      } else {
        setAiAnalysis(`⚠️ AI分析の実行中にエラーが発生しました。\n\n${errorMessage}`);
      }
    } finally {
      setAiLoading(false);
    }
  }, [comparePapers, sharedConceptIds, concepts, getPaperConcepts]);

  // --- Compare Mode ---
  if (compareMode && comparePapers.length >= 2) {
    return (
      <div className="papers-page page-container">
        <div className="papers-header">
          <h2>論文比較</h2>
          <div className="compare-header-actions">
            <div className="compare-view-tabs">
              <button
                className={`tab-btn ${compareView === "cards" ? "active" : ""}`}
                onClick={() => setCompareView("cards")}
              >
                カード比較
              </button>
              <button
                className={`tab-btn ${compareView === "table" ? "active" : ""}`}
                onClick={() => setCompareView("table")}
              >
                テーブル比較
              </button>
              <button
                className={`tab-btn ${compareView === "ai" ? "active" : ""}`}
                onClick={() => {
                  setCompareView("ai");
                  if (!aiAnalysis && !aiLoading) runAiAnalysis();
                }}
              >
                AI分析
              </button>
            </div>
            <button className="back-btn" onClick={exitCompareMode}>
              戻る
            </button>
          </div>
        </div>

        {sharedConceptIds.size > 0 && (
          <div className="shared-concepts-banner">
            共通概念: {sharedConceptIds.size}個
            <div className="shared-concept-tags">
              {[...sharedConceptIds].map((id) => {
                const c = concepts.find((x) => x.id === id);
                return c ? (
                  <span key={id} className="shared-tag" style={{ borderColor: CONCEPT_TYPE_COLORS[c.concept_type] }}>
                    {c.name_ja || c.name}
                  </span>
                ) : null;
              })}
            </div>
          </div>
        )}

        {compareView === "ai" ? (
          <div className="ai-analysis-panel">
            {aiLoading ? (
              <div className="ai-loading">
                <div className="ai-loading-spinner" />
                <p>論文を比較分析しています...</p>
              </div>
            ) : aiAnalysis ? (
              <div className="ai-analysis-content">
                <div className="ai-analysis-header">
                  <h3>AI比較分析</h3>
                  <button className="regenerate-btn" onClick={runAiAnalysis}>再分析</button>
                </div>
                <div className="ai-analysis-text">
                  {aiAnalysis.split("\n").map((line, i) => {
                    if (line.startsWith("**") && line.endsWith("**")) {
                      return <h4 key={i}>{line.replace(/\*\*/g, "")}</h4>;
                    }
                    if (line.match(/^\d+\.\s\*\*/)) {
                      const cleaned = line.replace(/\*\*/g, "");
                      return <h4 key={i} className="section-heading">{cleaned}</h4>;
                    }
                    if (line.startsWith("- ") || line.startsWith("* ")) {
                      return <li key={i}>{line.slice(2)}</li>;
                    }
                    if (line.trim() === "") return <br key={i} />;
                    return <p key={i}>{line}</p>;
                  })}
                </div>
              </div>
            ) : (
              <div className="ai-analysis-empty">
                <p>「AI分析」タブをクリックすると、AIが論文を比較分析します</p>
                <button className="compare-btn" onClick={runAiAnalysis}>分析を開始</button>
              </div>
            )}
          </div>
        ) : compareView === "cards" ? (
          <div className="compare-cards" style={{ gridTemplateColumns: `repeat(${comparePapers.length}, 1fr)` }}>
            {comparePapers.map((paper) => (
              <div key={paper.id} className="compare-card">
                <div className="compare-card-header">
                  <h3>{paper.summary.title_ja || paper.summary.title || paper.filename}</h3>
                  <div className="compare-card-meta">
                    {paper.summary.authors.length > 0 && (
                      <span>{paper.summary.authors.join(", ")}</span>
                    )}
                    {paper.summary.year && <span>({paper.summary.year})</span>}
                  </div>
                </div>

                {paper.summary.main_claim && (
                  <div className="compare-section">
                    <h4>主張</h4>
                    <p>{paper.summary.main_claim}</p>
                  </div>
                )}

                {paper.summary.abstract && (
                  <div className="compare-section">
                    <h4>要約</h4>
                    <p>{paper.summary.abstract}</p>
                  </div>
                )}

                <div className="compare-section">
                  <h4>起承転結</h4>
                  <div className="compare-flow">
                    {paper.summary.introduction && (
                      <div className="compare-flow-item">
                        <span className="flow-label">起</span>
                        <p>{paper.summary.introduction}</p>
                      </div>
                    )}
                    {paper.summary.development && (
                      <div className="compare-flow-item">
                        <span className="flow-label">承</span>
                        <p>{paper.summary.development}</p>
                      </div>
                    )}
                    {paper.summary.turn && (
                      <div className="compare-flow-item">
                        <span className="flow-label">転</span>
                        <p>{paper.summary.turn}</p>
                      </div>
                    )}
                    {paper.summary.conclusion && (
                      <div className="compare-flow-item">
                        <span className="flow-label">結</span>
                        <p>{paper.summary.conclusion}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="compare-section">
                  <h4>概念 ({paper.conceptIds.length})</h4>
                  <div className="concept-tags">
                    {getPaperConcepts(paper).map((concept) => (
                      <span
                        key={concept.id}
                        className={`concept-tag ${sharedConceptIds.has(concept.id) ? "shared" : ""}`}
                        style={{
                          borderColor: CONCEPT_TYPE_COLORS[concept.concept_type as ConceptType],
                        }}
                      >
                        {concept.name_ja || concept.name}
                        {sharedConceptIds.has(concept.id) && <span className="shared-icon"> ★</span>}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="compare-table-wrapper">
            <table className="compare-table">
              <thead>
                <tr>
                  <th>項目</th>
                  {comparePapers.map((p) => (
                    <th key={p.id}>{p.summary.title_ja || p.summary.title || p.filename}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="row-label">著者</td>
                  {comparePapers.map((p) => (
                    <td key={p.id}>{p.summary.authors.join(", ") || "-"}</td>
                  ))}
                </tr>
                <tr>
                  <td className="row-label">年</td>
                  {comparePapers.map((p) => (
                    <td key={p.id}>{p.summary.year || "-"}</td>
                  ))}
                </tr>
                <tr>
                  <td className="row-label">主張</td>
                  {comparePapers.map((p) => (
                    <td key={p.id}>{p.summary.main_claim || "-"}</td>
                  ))}
                </tr>
                <tr>
                  <td className="row-label">概念数</td>
                  {comparePapers.map((p) => (
                    <td key={p.id}>{p.conceptIds.length}</td>
                  ))}
                </tr>
                <tr>
                  <td className="row-label">共通概念</td>
                  {comparePapers.map((p) => (
                    <td key={p.id}>
                      {[...sharedConceptIds]
                        .filter((id) => p.conceptIds.includes(id))
                        .map((id) => {
                          const c = concepts.find((x) => x.id === id);
                          return c ? c.name_ja || c.name : "";
                        })
                        .join(", ") || "-"}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="row-label">独自概念</td>
                  {comparePapers.map((p) => (
                    <td key={p.id}>
                      {getPaperConcepts(p)
                        .filter((c) => !sharedConceptIds.has(c.id))
                        .map((c) => c.name_ja || c.name)
                        .join(", ") || "-"}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="row-label">起</td>
                  {comparePapers.map((p) => (
                    <td key={p.id}>{p.summary.introduction || "-"}</td>
                  ))}
                </tr>
                <tr>
                  <td className="row-label">承</td>
                  {comparePapers.map((p) => (
                    <td key={p.id}>{p.summary.development || "-"}</td>
                  ))}
                </tr>
                <tr>
                  <td className="row-label">転</td>
                  {comparePapers.map((p) => (
                    <td key={p.id}>{p.summary.turn || "-"}</td>
                  ))}
                </tr>
                <tr>
                  <td className="row-label">結</td>
                  {comparePapers.map((p) => (
                    <td key={p.id}>{p.summary.conclusion || "-"}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  // --- Normal Mode ---
  return (
    <div className="papers-page page-container">
      <div className="papers-header">
        <h2>論文ライブラリ</h2>
        <p className="subtitle">
          アップロードした論文の要約と抽出された知識を管理
        </p>
      </div>

      <div className="papers-content">
        <div className="papers-list-container">
          <div className="papers-list-header">
            <h3>保存済み論文 ({papers.length})</h3>
            <div className="papers-list-actions">
              {compareIds.size >= 2 && (
                <button className="compare-btn" onClick={() => setCompareMode(true)}>
                  比較する ({compareIds.size})
                </button>
              )}
              {papers.length > 0 && (
                <button className="clear-all-btn" onClick={handleClearAll}>
                  すべて削除
                </button>
              )}
            </div>
          </div>

          {papers.length === 0 ? (
            <div className="empty-state">
              <p>まだ論文が保存されていません</p>
              <p className="hint">
                ホームページから論文をアップロードして「知識資産として保存」してください
              </p>
            </div>
          ) : (
            <ul className="papers-list">
              {papers.map((paper) => (
                <li
                  key={paper.id}
                  className={`paper-item ${selectedPaper?.id === paper.id ? "selected" : ""} ${compareIds.has(paper.id) ? "compare-selected" : ""}`}
                >
                  <div
                    className="paper-item-header"
                    onClick={() => setSelectedPaper(paper)}
                  >
                    <label
                      className="compare-checkbox"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={compareIds.has(paper.id)}
                        onChange={() => toggleCompare(paper.id)}
                        disabled={!compareIds.has(paper.id) && compareIds.size >= 3}
                      />
                    </label>
                    <div className="paper-title-info">
                      <h4>{paper.summary.title_ja || paper.summary.title || paper.filename}</h4>
                      <span className="paper-date">{formatDate(paper.uploadedAt)}</span>
                    </div>
                    <div className="paper-meta-badges">
                      <span className="concept-count">
                        {paper.conceptIds.length} 概念
                      </span>
                      {paper.summary.original_language === "en" && (
                        <span className="language-badge">EN</span>
                      )}
                    </div>
                  </div>
                  <div className="paper-item-actions">
                    <button
                      className="expand-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedPaperId(
                          expandedPaperId === paper.id ? null : paper.id
                        );
                      }}
                    >
                      {expandedPaperId === paper.id ? "閉じる" : "詳細"}
                    </button>
                    <button
                      className="remove-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemovePaper(paper.id);
                      }}
                    >
                      削除
                    </button>
                  </div>

                  {expandedPaperId === paper.id && (
                    <div className="paper-expanded-content">
                      {paper.summary.authors.length > 0 && (
                        <p className="authors">
                          著者: {paper.summary.authors.join(", ")}
                          {paper.summary.year && ` (${paper.summary.year})`}
                        </p>
                      )}
                      {paper.summary.main_claim && (
                        <div className="main-claim">
                          <strong>主張:</strong> {paper.summary.main_claim}
                        </div>
                      )}
                      <div className="extracted-concepts">
                        <strong>抽出された概念:</strong>
                        <div className="concept-tags">
                          {getPaperConcepts(paper).map((concept) => (
                            <span
                              key={concept.id}
                              className="concept-tag"
                              style={{
                                borderColor: CONCEPT_TYPE_COLORS[concept.concept_type as ConceptType],
                              }}
                            >
                              {concept.name_ja || concept.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {selectedPaper && (
          <div className="paper-detail">
            <div className="detail-header">
              <h3>{selectedPaper.summary.title_ja || selectedPaper.summary.title}</h3>
              {selectedPaper.summary.title_en &&
               selectedPaper.summary.title_en !== selectedPaper.summary.title_ja && (
                <p className="title-en">{selectedPaper.summary.title_en}</p>
              )}
              <div className="detail-meta">
                {selectedPaper.summary.authors.length > 0 && (
                  <span>{selectedPaper.summary.authors.join(", ")}</span>
                )}
                {selectedPaper.summary.year && (
                  <span>({selectedPaper.summary.year})</span>
                )}
              </div>
            </div>

            {selectedPaper.summary.abstract && (
              <div className="detail-section">
                <h4>要約</h4>
                <p>{selectedPaper.summary.abstract}</p>
              </div>
            )}

            {selectedPaper.summary.main_claim && (
              <div className="detail-section highlight">
                <h4>この論文の主張</h4>
                <p>{selectedPaper.summary.main_claim}</p>
              </div>
            )}

            <div className="detail-section kishoutenketsu">
              <h4>起承転結</h4>
              <div className="flow-container">
                {selectedPaper.summary.introduction && (
                  <div className="flow-item ki">
                    <span className="flow-label">起</span>
                    <p>{selectedPaper.summary.introduction}</p>
                  </div>
                )}
                {selectedPaper.summary.development && (
                  <div className="flow-item shou">
                    <span className="flow-label">承</span>
                    <p>{selectedPaper.summary.development}</p>
                  </div>
                )}
                {selectedPaper.summary.turn && (
                  <div className="flow-item ten">
                    <span className="flow-label">転</span>
                    <p>{selectedPaper.summary.turn}</p>
                  </div>
                )}
                {selectedPaper.summary.conclusion && (
                  <div className="flow-item ketsu">
                    <span className="flow-label">結</span>
                    <p>{selectedPaper.summary.conclusion}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="detail-section explanation-section">
              <div className="explanation-header">
                <h4>わかりやすい説明</h4>
                <div className="explanation-level-selector">
                  <button
                    className={`level-btn ${explanationLevel === "middle_school" ? "active" : ""}`}
                    onClick={() => setExplanationLevel("middle_school")}
                  >
                    中学生
                  </button>
                  <button
                    className={`level-btn ${explanationLevel === "high_school" ? "active" : ""}`}
                    onClick={() => setExplanationLevel("high_school")}
                  >
                    高校生
                  </button>
                  <button
                    className={`level-btn ${explanationLevel === "university" ? "active" : ""}`}
                    onClick={() => setExplanationLevel("university")}
                  >
                    大学生
                  </button>
                  <button
                    className={`level-btn ${explanationLevel === "researcher" ? "active" : ""}`}
                    onClick={() => setExplanationLevel("researcher")}
                  >
                    研究者
                  </button>
                </div>
              </div>
              <p className="explanation-text">
                {explanationLevel === "middle_school" && selectedPaper.summary.middle_school_explanation}
                {explanationLevel === "high_school" && selectedPaper.summary.high_school_explanation}
                {explanationLevel === "university" && selectedPaper.summary.university_explanation}
                {explanationLevel === "researcher" && selectedPaper.summary.researcher_explanation}
              </p>
            </div>

            <div className="detail-section concepts">
              <h4>抽出された概念 ({selectedPaper.conceptIds.length})</h4>
              <div className="concept-list">
                {getPaperConcepts(selectedPaper).map((concept) => (
                  <div key={concept.id} className="concept-item">
                    <div className="concept-header">
                      <span
                        className="type-dot"
                        style={{
                          backgroundColor: CONCEPT_TYPE_COLORS[concept.concept_type as ConceptType],
                        }}
                      />
                      <strong>{concept.name_ja || concept.name}</strong>
                      <span
                        className="type-label"
                        style={{
                          backgroundColor: CONCEPT_TYPE_COLORS[concept.concept_type as ConceptType],
                        }}
                      >
                        {CONCEPT_TYPE_LABELS[concept.concept_type as ConceptType]}
                      </span>
                    </div>
                    <p>{concept.definition_ja || concept.definition}</p>
                  </div>
                ))}
              </div>
            </div>

            <button
              className="close-detail-btn"
              onClick={() => setSelectedPaper(null)}
            >
              閉じる
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
