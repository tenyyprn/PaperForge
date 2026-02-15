import { useState, useEffect } from "react";
import { useGraphStore } from "../stores/graphStore";
import { useLearningPathStore } from "../stores/learningPathStore";
import { usePaperStore } from "../stores/paperStore";
import { useSettingsStore } from "../stores/settingsStore";
import { getGraphStats, setApiBaseUrl, apiClient } from "../api/client";

export function SettingsPage() {
  const { concepts, relations, clearGraph } = useGraphStore();
  const { paths, clearPaths } = useLearningPathStore();
  const { papers, clearPapers } = usePaperStore();
  const { defaultUploadDirectory, setDefaultUploadDirectory } = useSettingsStore();
  const [apiUrl, setApiUrl] = useState(
    localStorage.getItem("apiUrl") || apiClient.defaults.baseURL || ""
  );
  const [saved, setSaved] = useState(false);
  const [storageType, setStorageType] = useState<
    "firestore" | "memory" | "checking" | "error"
  >("checking");
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [importMessage, setImportMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [directorySaved, setDirectorySaved] = useState(false);

  useEffect(() => {
    getGraphStats()
      .then((stats) => setStorageType(stats.storage))
      .catch(() => setStorageType("error"));
  }, []);

  const handleSelectDirectory = async () => {
    try {
      // File System Access API を使用してディレクトリを選択
      if ('showDirectoryPicker' in window) {
        const dirHandle = await (window as any).showDirectoryPicker();
        // ディレクトリハンドルの名前（パス）を保存
        setDefaultUploadDirectory(dirHandle.name);
        setDirectorySaved(true);
        setTimeout(() => setDirectorySaved(false), 2000);
      } else {
        alert('お使いのブラウザはディレクトリ選択機能に対応していません。Chrome または Edge をご使用ください。');
      }
    } catch (err) {
      // ユーザーがキャンセルした場合は何もしない
      console.log('Directory selection cancelled');
    }
  };

  const handleClearDirectory = () => {
    setDefaultUploadDirectory('');
    setDirectorySaved(true);
    setTimeout(() => setDirectorySaved(false), 2000);
  };

  const handleSaveApiUrl = () => {
    setApiBaseUrl(apiUrl);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    // ストレージステータスを再チェック
    getGraphStats()
      .then((stats) => setStorageType(stats.storage))
      .catch(() => setStorageType("error"));
  };

  const handleClearData = () => {
    clearGraph();
    clearPaths();
    clearPapers();
    localStorage.removeItem("graph-storage");
    localStorage.removeItem("paperforge-learning-paths");
    localStorage.removeItem("paperforge-papers");
    setShowClearConfirm(false);
  };

  const handleExportData = () => {
    const data = {
      concepts,
      relations,
      papers,
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
          setImportMessage({
            type: "success",
            text: `${data.concepts.length}件の概念をインポートしました`,
          });
        } else {
          setImportMessage({
            type: "error",
            text: "有効なデータが見つかりませんでした",
          });
        }
      } catch {
        setImportMessage({
          type: "error",
          text: "ファイルの読み込みに失敗しました",
        });
      }
      setTimeout(() => setImportMessage(null), 4000);
    };
    reader.readAsText(file);
    // input をリセット
    e.target.value = "";
  };

  const totalItems = concepts.length + relations.length + papers.length + paths.length;

  return (
    <div className="settings-page page-container">
      <div className="settings-header">
        <h2>設定</h2>
        <p className="subtitle">アプリの設定とデータ管理</p>
      </div>

      <section className="settings-section">
        <div className="section-title">
          <span className="section-icon">🔗</span>
          <div>
            <h3>API接続</h3>
            <p className="section-desc">
              バックエンドサーバーとの接続設定
            </p>
          </div>
        </div>
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
        </div>
        <div className="storage-status">
          <span className="storage-label">ストレージ:</span>
          {storageType === "checking" ? (
            <span className="storage-badge checking">確認中...</span>
          ) : storageType === "error" ? (
            <span className="storage-badge offline">接続エラー</span>
          ) : storageType === "firestore" ? (
            <span className="storage-badge firestore">Firestore</span>
          ) : (
            <span className="storage-badge memory">ローカルのみ</span>
          )}
        </div>
      </section>

      <section className="settings-section">
        <div className="section-title">
          <span className="section-icon">📁</span>
          <div>
            <h3>アップロード設定</h3>
            <p className="section-desc">
              論文アップロード時のデフォルトディレクトリ
            </p>
          </div>
        </div>
        <div className="setting-item">
          <label htmlFor="default-directory">デフォルトディレクトリ</label>
          <div className="directory-display">
            {defaultUploadDirectory ? (
              <div className="directory-info">
                <span className="directory-path">📂 {defaultUploadDirectory}</span>
                <button onClick={handleClearDirectory} className="clear-dir-btn">
                  クリア
                </button>
              </div>
            ) : (
              <span className="directory-empty">未設定</span>
            )}
          </div>
          <button onClick={handleSelectDirectory} className="select-dir-btn">
            {directorySaved ? "保存しました" : "ディレクトリを選択"}
          </button>
          <p className="setting-hint">
            ※ Chrome, Edge などモダンブラウザのみ対応しています
          </p>
        </div>
      </section>

      <section className="settings-section">
        <div className="section-title">
          <span className="section-icon">📊</span>
          <div>
            <h3>データ管理</h3>
            <p className="section-desc">
              保存されたデータの確認・エクスポート・インポート
            </p>
          </div>
        </div>
        <div className="data-stats">
          <div className="stat-item">
            <span className="stat-value">{papers.length}</span>
            <span className="stat-label">論文</span>
          </div>
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
          <button
            onClick={handleExportData}
            className="export-btn"
            disabled={totalItems === 0}
          >
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
          <button
            onClick={() => setShowClearConfirm(true)}
            className="danger-btn"
            disabled={totalItems === 0}
          >
            すべてのデータを削除
          </button>
        </div>

        {importMessage && (
          <div className={`settings-toast ${importMessage.type}`}>
            {importMessage.text}
          </div>
        )}

        {showClearConfirm && (
          <div className="clear-confirm">
            <p>
              すべてのデータ（{concepts.length}概念、{relations.length}
              関係性、{papers.length}論文、{paths.length}
              学習パス）を削除しますか？
            </p>
            <p className="clear-confirm-warn">この操作は元に戻せません。</p>
            <div className="clear-confirm-actions">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="cancel-btn"
              >
                キャンセル
              </button>
              <button onClick={handleClearData} className="danger-btn">
                削除する
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="settings-section">
        <div className="section-title">
          <span className="section-icon">ℹ️</span>
          <div>
            <h3>アプリ情報</h3>
          </div>
        </div>
        <div className="app-info">
          <p>
            <strong>PaperForge</strong>
          </p>
          <p className="version">バージョン 0.1.0</p>
          <p className="description">
            論文を自分の知識資産に変えるパーソナルナレッジエージェント
          </p>
          <a
            href="https://github.com/tenyyprn/PaperForge"
            target="_blank"
            rel="noopener noreferrer"
            className="github-link"
          >
            GitHub リポジトリ
          </a>
        </div>
      </section>
    </div>
  );
}
