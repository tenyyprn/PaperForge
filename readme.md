# PaperForge

**論文を自分の知識資産に変える** パーソナルナレッジエージェント

## 🎯 コンセプト

論文を"読むだけ"で終わらせない。
概念と関係性を抽出し、自分だけの知識資産として再構築する。
AIエージェントと対話しながら、理解を深め、学びを加速する。

## 👤 ユースケース

PaperForgeは次のような場面で価値を発揮します。

- 大学院生が関連研究を短時間で俯瞰したいとき
- 新しい分野の論文を体系的に学びたいとき
- 複数論文の差分を整理したいとき
- 知識の抜け漏れを可視化したいとき
- 試験・発表前に理解度を確認したいとき

## ✨ 機能

PaperForgeは以下の機能群により、論文理解のワークフローをエンドツーエンドで支援します。

| 機能 | 説明 |
|------|------|
| 📄 論文アップロード | PDFをアップロードして概念・関係性を自動抽出。起承転結の要約を日本語で生成 |
| 🕸️ ナレッジグラフ | 抽出した概念を階層構造で可視化。探索モードで接続概念をハイライト |
| 📅 タイムラインビュー | 論文の発表年に基づいてX軸に時系列配置。研究の発展を時間軸で俯瞰 |
| 🎨 論文別色分け | 各論文に固有の色を割り当て、概念の由来論文を視覚的に区別 |
| 📚 論文ライブラリ | 保存した論文の一覧管理。要約・抽出概念・起承転結をいつでも確認 |
| 🔀 論文比較 | 最大3本の論文を並列比較（カード/テーブル）。共通概念のハイライト |
| 🤖 AI比較分析 | 論文の優劣・手法・貢献度に加え、引用関係の推定・時系列の発展を自動分析 |
| 💬 学習チャット | ADK Tutor Agentと対話して知識を深める。クイックリプライで直感的に操作 |
| 🗺️ 学習パス | 概念の依存関係を考慮した最適な学習順序を自動生成 |
| ❓ 理解度クイズ | 登録した概念から難易度別クイズを生成。スコア表示で理解度を可視化 |
| ⚙️ データ管理 | JSON形式でエクスポート/インポート |

## 🎥 デモシナリオ

1. **論文アップロード** — PDFをドラッグ&ドロップ
2. **自動解析** — 概念・関係性を抽出、起承転結の要約を日本語で生成
3. **ナレッジグラフ** — 抽出した概念をインタラクティブに可視化
4. **論文比較** — 3本の論文をカード/テーブル/AI分析で比較
5. **学習パス生成** — 概念の依存関係から最適な学習順序を提案
6. **クイズで理解度チェック** — 登録概念から自動生成されたクイズに挑戦

## 📈 期待効果（目安）

| 指標 | 従来ワークフロー | PaperForge利用時 |
|------|:----------------:|:----------------:|
| 論文1本の概念整理 | 60〜90 分 | **5〜10 分**（自動抽出） |
| 3本の横断比較 | 半日〜1日 | **数分**（AI比較分析） |
| 知識の抜け漏れ発見 | 自己申告のみ | **クイズ＋グラフで定量化** |

> **Novelty — 何が新しいか:**
> 既存ツール（Connected Papers, Elicit 等）が *論文同士の引用ネットワーク* に留まるのに対し、PaperForge は **論文内部の"概念"を自動抽出し、概念レベルで横断・比較・学習支援まで一気通貫で行う** 点が新しい。

## 🔍 既存ツールとの違い

| 観点 | PaperForge | Connected Papers | Elicit | Research Rabbit |
|------|:----------:|:----------------:|:------:|:---------------:|
| 概念自動抽出 | ◎ | △ | △ | △ |
| ナレッジグラフ | ◎ | ○ | × | ○ |
| 論文比較（AI分析） | ◎ | × | △ | × |
| 学習パス生成 | ◎ | × | × | × |
| 理解度クイズ | ◎ | × | × | × |
| AIチャット（エージェント） | ◎ | × | ○ | × |
| 日本語対応 | ◎ | △ | △ | △ |

## 🏗️ アーキテクチャ

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend（React + TypeScript + Vite）                       │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐     │
│  │ Home │ │Papers│ │Graph │ │ Path │ │ Quiz │ │ Chat │     │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘     │
│  Zustand（永続化ストア）                                      │
└─────────────────────┬───────────────────────────────────────┘
                      │ REST API
┌─────────────────────▼───────────────────────────────────────┐
│  Backend（FastAPI + Cloud Run）                               │
│  /papers  /graph  /chat  /learning-path  /adk               │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│  ADK（Agent Development Kit）                                │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │
│  │ Extraction  │ │   Graph     │ │   Tutor     │            │
│  │   Agent     │ │   Agent     │ │   Agent     │            │
│  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘            │
│         │  FunctionTool  │  FunctionTool │  FunctionTool     │
│  ┌──────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐            │
│  │ 概念抽出    │ │ グラフ操作  │ │ 説明/クイズ │            │
│  │ 関係抽出    │ │ 検索/更新   │ │ 学習パス    │            │
│  └─────────────┘ └─────────────┘ └─────────────┘            │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│  Vertex AI（Gemini 2.0 Flash）                               │
│  概念抽出・対話・推論・学習パス生成・クイズ生成               │
└─────────────────────────────────────────────────────────────┘
```

## 🛠️ 技術スタック

| レイヤー | 技術 | 役割 |
|----------|------|------|
| フロントエンド | React + TypeScript + Vite | SPA UI |
| 状態管理 | Zustand (persist) | グラフ・論文データの永続化 |
| 可視化 | react-force-graph-2d + Canvas API | ナレッジグラフ描画（階層/タイムラインレイアウト） |
| バックエンド | FastAPI + Uvicorn | REST API |
| データベース | Firestore + ベクトルストア | 論文・概念の永続化 |
| エージェント | Google ADK (Runner + FunctionTool) | マルチエージェント構成・セッション管理 |
| AI | Vertex AI (Gemini 2.0 Flash) | 概念抽出・対話・推論 |
| デプロイ | Docker + Cloud Run (asia-northeast1) | コンテナデプロイ |

## 📁 ディレクトリ構成

```
paperforge/
├── readme.md
├── Dockerfile              # Cloud Run向けマルチステージビルド
├── pyproject.toml           # Python依存関係
├── .env.example             # 環境変数テンプレート
├── agents/                  # ADKエージェント
│   ├── extraction/          # 概念抽出Agent
│   │   ├── agent.py
│   │   └── tools.py
│   ├── graph/               # グラフ操作Agent
│   │   ├── agent.py
│   │   └── tools.py
│   ├── tutor/               # 学習支援Agent
│   │   ├── agent.py         # ADK Agent定義（gemini-2.0-flash）
│   │   └── tools.py         # explain_concept, generate_quiz, etc.
│   ├── runner.py            # ADK Runner ラッパー
│   └── orchestrator.py      # エージェント統合
├── api/                     # FastAPI バックエンド
│   ├── main.py              # エントリーポイント
│   ├── db/
│   │   ├── firestore.py     # Firestore連携
│   │   └── vectors.py       # ベクトルストア
│   └── routers/
│       ├── papers.py        # 論文アップロード・概念抽出
│       ├── graph.py         # グラフCRUD操作
│       ├── chat.py          # チャット（Function Calling）
│       ├── adk_chat.py      # ADK Runner統合チャット
│       ├── agents.py        # エージェント管理
│       └── learning_path.py # 学習パス生成
├── frontend/                # React フロントエンド
│   └── src/
│       ├── App.tsx          # ルーティング
│       ├── pages/
│       │   ├── HomePage.tsx         # 論文アップロード・要約表示
│       │   ├── PapersPage.tsx       # 論文ライブラリ・比較・AI分析
│       │   ├── GraphPage.tsx        # ナレッジグラフ（階層/タイムライン、論文別色分け）
│       │   ├── ChatPage.tsx         # ADK Tutor Agentチャット
│       │   ├── LearningPathPage.tsx # 学習パス
│       │   ├── QuizPage.tsx         # 理解度クイズ
│       │   └── SettingsPage.tsx     # 設定・データ管理
│       ├── stores/
│       │   ├── graphStore.ts        # 概念・関係の状態管理
│       │   └── paperStore.ts        # 論文データの状態管理
│       ├── components/
│       │   ├── Layout.tsx           # 共通レイアウト
│       │   └── AgentActivity.tsx    # エージェント活動表示
│       └── api/
│           └── client.ts            # APIクライアント
└── fine-tuning/             # Gemma LoRA関連
    ├── train_lora.py
    └── convert_scierc.py
```

## 🚀 セットアップ

### 環境変数

```bash
cp .env.example .env
# .env を編集して API キーを設定
```

**Option 1: Gemini API キー（開発用）**
```
GOOGLE_API_KEY=your-api-key-here
```

**Option 2: Vertex AI（本番環境・推奨）**
```
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_CLOUD_LOCATION=us-central1
GOOGLE_GENAI_USE_VERTEXAI=TRUE
```

### バックエンド

```bash
# Python仮想環境
python -m venv .venv
source .venv/bin/activate

# 依存関係インストール
pip install -e .

# サーバー起動
uvicorn api.main:app --reload --port 8001
```

### フロントエンド

```bash
cd frontend
npm install
npm run dev
```

### Docker

```bash
docker build -t paperforge .
docker run -p 8080:8080 --env-file .env paperforge
```

### Cloud Run デプロイ

```bash
gcloud run deploy paperforge \
  --source . \
  --project=your-project-id \
  --region=asia-northeast1 \
  --set-env-vars="GOOGLE_GENAI_USE_VERTEXAI=TRUE,GOOGLE_CLOUD_PROJECT=your-project-id,GOOGLE_CLOUD_LOCATION=us-central1" \
  --allow-unauthenticated
```

> **Note:** Cloud Run は `asia-northeast1` にデプロイしますが、Vertex AI (Gemini) の呼び出し先は `us-central1` です（モデル提供リージョンの制約）。

## 🌐 デプロイ

- **URL**: https://paperforge-740219973201.asia-northeast1.run.app
- **プラットフォーム**: Cloud Run (`asia-northeast1`)
- **AI**: Vertex AI / Gemini 2.0 Flash (`us-central1`)

## 📝 提出物（第4回 Agentic AI Hackathon with Google Cloud）

- [x] デプロイURL
- [ ] GitHubリポジトリ（公開）
- [ ] Zenn記事（4000〜6000字）
  - [ ] プロジェクト概要
  - [ ] システムアーキテクチャ図
  - [ ] デモ動画（3分以内、YouTube）

## ⚠️ 注意事項

- 概念抽出の精度は Gemini 2.0 Flash の出力に依存します。専門性の高い論文では手動補正が必要な場合があります
- 現在のデータはブラウザの LocalStorage（Zustand persist）に保存されます。ブラウザデータを削除すると消失します
- Vertex AI の利用には Google Cloud の課金アカウントが必要です

## 📄 ライセンス

MIT License

## 👤 Author

y.ori
