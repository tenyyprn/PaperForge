import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { uploadPaper, startPipeline, streamActivities, type PaperResponse, type AgentActivity } from "../api/client";
import { useGraphStore, CONCEPT_TYPE_COLORS, CONCEPT_TYPE_LABELS, type ConceptType } from "../stores/graphStore";
import { usePaperStore, createPaperFromResponse } from "../stores/paperStore";
import { useSettingsStore } from "../stores/settingsStore";
import { AgentActivityPanel } from "../components/AgentActivity";

type Status = "idle" | "uploading" | "success" | "error";

type ExplanationLevel = "middle_school" | "high_school" | "university" | "researcher";

export function HomePage() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<PaperResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [activities, setActivities] = useState<AgentActivity[]>([]);
  const [pipelineResult, setPipelineResult] = useState<string>("");
  const [explanationLevel, setExplanationLevel] = useState<ExplanationLevel>("high_school");
  const { addConcepts, addRelations } = useGraphStore();
  const { addPaper } = usePaperStore();
  const { defaultUploadDirectory } = useSettingsStore();
  const navigate = useNavigate();
  const eventSourceRef = useRef<EventSource | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleFileSelect = async () => {
    try {
      // File System Access API をサポートしているか確認
      if ('showOpenFilePicker' in window) {
        const opts: any = {
          types: [
            {
              description: 'Documents',
              accept: {
                'application/pdf': ['.pdf'],
                'text/plain': ['.txt'],
              },
            },
          ],
          multiple: false,
        };

        // デフォルトディレクトリが設定されている場合、そこから開始
        // ※ ディレクトリ名のみでは開始位置を指定できないため、
        //    ブラウザが最後に使用したディレクトリを記憶する動作に依存します
        if (defaultUploadDirectory) {
          // File System Access API では特定パスを直接指定できないため、
          // ブラウザのデフォルト動作（最後に使用した場所）を利用
          console.log('Default directory hint:', defaultUploadDirectory);
        }

        const [fileHandle] = await (window as any).showOpenFilePicker(opts);
        const selectedFile = await fileHandle.getFile();
        setFile(selectedFile);
        setStatus("idle");
        setResult(null);
        setError(null);
      } else {
        // File System Access API 非対応の場合、通常のfile inputを使用
        fileInputRef.current?.click();
      }
    } catch (err) {
      // ユーザーがキャンセルした場合は何もしない
      console.log('File selection cancelled');
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
        {defaultUploadDirectory && (
          <p className="upload-hint">
            📁 デフォルトディレクトリ: {defaultUploadDirectory}
          </p>
        )}
        <div className="upload-area">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt"
            onChange={handleFileChange}
            id="file-input"
            style={{ display: 'none' }}
          />
          <button onClick={handleFileSelect} className="file-label">
            <span className="file-icon">📄</span>
            <span className="file-text">
              {file ? file.name : "クリックしてファイルを選択"}
            </span>
            <span className="file-hint">PDF または TXT ファイル</span>
          </button>
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

                <div className="summary-section explanation-section">
                  <div className="explanation-header">
                    <h5>わかりやすい説明</h5>
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
                    {explanationLevel === "middle_school" && result.summary.middle_school_explanation}
                    {explanationLevel === "high_school" && result.summary.high_school_explanation}
                    {explanationLevel === "university" && result.summary.university_explanation}
                    {explanationLevel === "researcher" && result.summary.researcher_explanation}
                  </p>
                </div>
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
