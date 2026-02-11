import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { uploadPaper, startPipeline, streamActivities, type PaperResponse, type AgentActivity } from "../api/client";
import { useGraphStore, CONCEPT_TYPE_COLORS, CONCEPT_TYPE_LABELS, type ConceptType } from "../stores/graphStore";
import { usePaperStore, createPaperFromResponse } from "../stores/paperStore";
import { AgentActivityPanel } from "../components/AgentActivity";

type Status = "idle" | "uploading" | "success" | "error";

export function HomePage() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<PaperResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [activities, setActivities] = useState<AgentActivity[]>([]);
  const [pipelineResult, setPipelineResult] = useState<string>("");
  const { addConcepts, addRelations } = useGraphStore();
  const { addPaper } = usePaperStore();
  const navigate = useNavigate();
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setStatus("idle");
      setResult(null);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setStatus("uploading");
    setError(null);
    setActivities([]);
    setPipelineResult("");

    try {
      const response = await uploadPaper(file);
      setResult(response);
      setStatus("success");
      setAdded(false);

      // アップロード成功後、マルチエージェントパイプラインをSSEストリーミングで実行
      setPipelineRunning(true);
      try {
        const { session_id } = await startPipeline(
          "pipeline",
          JSON.stringify({
            summary: response.summary,
            concepts: response.concepts?.map(c => c.name) || [],
          }),
          file.name,
          response.concepts || [],
        );

        eventSourceRef.current?.close();
        eventSourceRef.current = streamActivities(
          session_id,
          (activity) => setActivities((prev) => [...prev, activity]),
          (result) => {
            setPipelineResult((result?.pipeline_result as string) || "");
            setPipelineRunning(false);
          },
          () => {
            console.warn("Pipeline SSE connection error (non-critical)");
            setPipelineRunning(false);
          },
        );
      } catch {
        console.warn("Pipeline start failed (non-critical)");
        setPipelineRunning(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "アップロードに失敗しました");
      setStatus("error");
    }
  };

  return (
    <div className="home-page page-container">
      <section className="hero">
        <h2>論文を自分の知識資産に変える</h2>
        <p>
          論文から概念と関係性を抽出し、自分だけのナレッジグラフを構築。
          <br />
          エージェントと対話しながら、知識を育てましょう。
        </p>
      </section>

      <section className="upload-section">
        <h3>論文をアップロード</h3>
        <div className="upload-area">
          <input
            type="file"
            accept=".pdf,.txt"
            onChange={handleFileChange}
            id="file-input"
          />
          <label htmlFor="file-input" className="file-label">
            <span className="file-icon">📄</span>
            <span className="file-text">
              {file ? file.name : "クリックしてファイルを選択"}
            </span>
            <span className="file-hint">PDF または TXT ファイル</span>
          </label>
          <button
            onClick={handleUpload}
            disabled={!file || status === "uploading"}
          >
            {status === "uploading"
              ? "解析中..."
              : file
                ? "アップロードして解析"
                : "ファイルを選択してください"}
          </button>
        </div>

        {error && <div className="error-message">{error}</div>}

        {(pipelineRunning || activities.length > 0) && (
          <div className="pipeline-section">
            <h3>
              {pipelineRunning ? "エージェントパイプライン実行中..." : "エージェントパイプライン完了"}
            </h3>
            <AgentActivityPanel activities={activities} />
            {pipelineResult && (
              <div className="pipeline-result">
                <h4>パイプライン結果</h4>
                <p>{pipelineResult}</p>
              </div>
            )}
          </div>
        )}

        {result && (
          <div className="result-section">
            <h3>解析結果</h3>

            {/* 論文要約 */}
            {result.summary && (
              <div className="paper-summary">
                <div className="summary-header">
                  {result.summary.original_language === "en" && (
                    <span className="language-badge">EN → JA</span>
                  )}
                  <h4 className="paper-title">
                    {result.summary.title_ja || result.summary.title || result.filename}
                  </h4>
                  {result.summary.title_en && result.summary.title_en !== result.summary.title_ja && (
                    <p className="paper-title-en">{result.summary.title_en}</p>
                  )}
                  <div className="paper-meta">
                    {result.summary.authors.length > 0 && (
                      <span className="authors">{result.summary.authors.join(", ")}</span>
                    )}
                    {result.summary.year && (
                      <span className="year">({result.summary.year})</span>
                    )}
                  </div>
                </div>

                {result.summary.abstract && (
                  <div className="summary-section">
                    <h5>要約</h5>
                    <p>{result.summary.abstract}</p>
                  </div>
                )}

                {result.summary.main_claim && (
                  <div className="summary-section main-claim">
                    <h5>この論文の主張</h5>
                    <p>{result.summary.main_claim}</p>
                  </div>
                )}

                <div className="kishoutenketsu">
                  <h5>起承転結</h5>
                  <div className="flow-container">
                    {result.summary.introduction && (
                      <div className="flow-item ki">
                        <span className="flow-label">起</span>
                        <p>{result.summary.introduction}</p>
                      </div>
                    )}
                    {result.summary.development && (
                      <div className="flow-item shou">
                        <span className="flow-label">承</span>
                        <p>{result.summary.development}</p>
                      </div>
                    )}
                    {result.summary.turn && (
                      <div className="flow-item ten">
                        <span className="flow-label">転</span>
                        <p>{result.summary.turn}</p>
                      </div>
                    )}
                    {result.summary.conclusion && (
                      <div className="flow-item ketsu">
                        <span className="flow-label">結</span>
                        <p>{result.summary.conclusion}</p>
                      </div>
                    )}
                  </div>
                </div>

                {result.summary.easy_explanation && (
                  <div className="summary-section easy-explanation">
                    <h5>高校生向けやさしい説明</h5>
                    <p>{result.summary.easy_explanation}</p>
                  </div>
                )}
              </div>
            )}

            <div className="result-card">
              <p>
                <strong>ファイル:</strong> {result.filename}
              </p>
              <p>
                <strong>ステータス:</strong> {result.status}
              </p>

              {result.concepts && result.concepts.length > 0 && (
                <div className="concepts-list">
                  <h4>抽出された概念 ({result.concepts.length})</h4>
                  <ul>
                    {result.concepts.map((concept) => (
                      <li key={concept.id} style={{ borderLeftColor: CONCEPT_TYPE_COLORS[(concept.concept_type || "concept") as ConceptType] }}>
                        <div className="concept-header">
                          <div className="concept-names">
                            <strong>{concept.name_ja || concept.name}</strong>
                            {concept.name_en && concept.name_en !== concept.name_ja && (
                              <span className="concept-name-en">{concept.name_en}</span>
                            )}
                          </div>
                          <span
                            className="concept-type-tag"
                            style={{
                              backgroundColor: CONCEPT_TYPE_COLORS[(concept.concept_type || "concept") as ConceptType],
                              color: "#0d0d14"
                            }}
                          >
                            {CONCEPT_TYPE_LABELS[(concept.concept_type || "concept") as ConceptType]}
                          </span>
                        </div>
                        <p>{concept.definition_ja || concept.definition}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {result.relations && result.relations.length > 0 && (
                <div className="relations-list">
                  <h4>抽出された関係性 ({result.relations.length})</h4>
                  <ul>
                    {result.relations.map((relation) => (
                      <li key={relation.id}>
                        {relation.source} → {relation.relation_type} →{" "}
                        {relation.target}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="result-actions">
                <button
                  className="add-to-graph-btn"
                  onClick={() => {
                    if (result.concepts) addConcepts(result.concepts);
                    if (result.relations) addRelations(result.relations);
                    // 論文を保存
                    if (result.summary) {
                      const paper = createPaperFromResponse(
                        result.paper_id,
                        result.filename,
                        result.summary,
                        result.concepts || [],
                        result.relations || []
                      );
                      addPaper(paper);
                    }
                    setAdded(true);
                  }}
                  disabled={added}
                >
                  {added ? "知識として保存済み" : "知識資産として保存"}
                </button>
                {added && (
                  <>
                    <button
                      className="view-graph-btn"
                      onClick={() => navigate("/graph")}
                    >
                      グラフを見る
                    </button>
                    <button
                      className="view-papers-btn"
                      onClick={() => navigate("/papers")}
                    >
                      論文一覧を見る
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
