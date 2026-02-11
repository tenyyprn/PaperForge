import { useState } from "react";
import { useGraphStore } from "../stores/graphStore";
import { useLearningPathStore } from "../stores/learningPathStore";

export function SettingsPage() {
  const { concepts, relations, clearGraph } = useGraphStore();
  const { paths, clearPaths } = useLearningPathStore();
  const [apiUrl, setApiUrl] = useState(
    localStorage.getItem("apiUrl") || "http://localhost:8001"
  );
  const [saved, setSaved] = useState(false);

  const handleSaveApiUrl = () => {
    localStorage.setItem("apiUrl", apiUrl);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClearData = () => {
    if (
      confirm(
        "すべてのデータをクリアしますか？この操作は元に戻せません。"
      )
    ) {
      clearGraph();
      clearPaths();
      localStorage.removeItem("graph-storage");
      localStorage.removeItem("paperforge-learning-paths");
    }
  };

  const handleExportData = () => {
    const data = {
      concepts,
      relations,
      learningPaths: paths,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `paperforge-export-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.concepts && Array.isArray(data.concepts)) {
          const { addConcepts, addRelations } = useGraphStore.getState();
          addConcepts(data.concepts);
          if (data.relations) {
            addRelations(data.relations);
          }
          if (data.learningPaths && Array.isArray(data.learningPaths)) {
            const { savePath } = useLearningPathStore.getState();
            for (const lp of data.learningPaths) {
              savePath(lp.steps, lp.summary);
            }
          }
          alert(`${data.concepts.length}件の概念をインポートしました`);
        }
      } catch {
        alert("ファイルの読み込みに失敗しました");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="settings-page page-container">
      <h2>設定</h2>

      <section className="settings-section">
        <h3>API設定</h3>
        <div className="setting-item">
          <label htmlFor="api-url">APIサーバーURL</label>
          <div className="input-group">
            <input
              id="api-url"
              type="text"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="http://localhost:8001"
            />
            <button onClick={handleSaveApiUrl} className="save-btn">
              {saved ? "保存しました" : "保存"}
            </button>
          </div>
          <p className="setting-hint">
            バックエンドAPIサーバーのURLを設定します
          </p>
        </div>
      </section>

      <section className="settings-section">
        <h3>データ管理</h3>
        <div className="data-stats">
          <div className="stat-item">
            <span className="stat-value">{concepts.length}</span>
            <span className="stat-label">概念</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{relations.length}</span>
            <span className="stat-label">関係性</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{paths.length}</span>
            <span className="stat-label">学習パス</span>
          </div>
        </div>

        <div className="data-actions">
          <button onClick={handleExportData} className="export-btn">
            データをエクスポート
          </button>
          <label className="import-btn">
            データをインポート
            <input
              type="file"
              accept=".json"
              onChange={handleImportData}
              hidden
            />
          </label>
          <button onClick={handleClearData} className="danger-btn">
            すべてのデータを削除
          </button>
        </div>
      </section>

      <section className="settings-section">
        <h3>アプリ情報</h3>
        <div className="app-info">
          <p>
            <strong>PaperForge</strong>
          </p>
          <p className="version">バージョン 0.1.0</p>
          <p className="description">
            論文を自分の知識資産に変えるパーソナルナレッジエージェント
          </p>
        </div>
      </section>
    </div>
  );
}
