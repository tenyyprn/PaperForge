import { useState } from "react";

export function HomePage() {
  const [file, setFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    // TODO: API呼び出しを実装
    console.log("Uploading:", file.name);
  };

  return (
    <div className="home-page">
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
          <label htmlFor="file-input">
            {file ? file.name : "ファイルを選択またはドラッグ＆ドロップ"}
          </label>
          <button onClick={handleUpload} disabled={!file}>
            アップロードして解析
          </button>
        </div>
      </section>
    </div>
  );
}
