# PaperForge

**論文を自分の知識資産に変える** パーソナルナレッジエージェント

## 🎯 コンセプト

論文を読んで終わりにしない。
概念と関係性を抽出し、自分だけのナレッジグラフを構築。
エージェントと対話しながら、知識を育てる。

## ✨ 機能

| 機能 | 説明 |
|------|------|
| 📄 論文アップロード | PDFをアップロードして概念・関係性を自動抽出。起承転結の要約を日本語で生成 |
| 🕸️ ナレッジグラフ | 抽出した概念を階層構造で可視化。探索モードで接続概念をハイライト |
| 📅 タイムラインビュー | 論文の発表年に基づいてX軸に時系列配置。研究の発展を時間軸で俯瞰 |
| 🎨 論文別色分け | 各論文に固有の色を割り当て、概念
の由来論文を視覚的に区別 |
| 📚 論文ライブラリ | 保存した論文の一覧管理。要約・抽出概念・起承転結をいつでも確認 |
| 🔀 論文比較 | 最大3本の論文を並列比較（カード/テーブル）。共通概念のハイライト |
| 🤖 AI比較分析 | 論文の優劣・手法・貢献度に加え、引用関係の推定・時系列の発展を自動分析 |
| 💬 学習チャット | Tutor Agentと対話して知識を深める |
| 🗺️ 学習パス | 概念の最適な学習順序を自動生成 |
| ❓ 理解度クイズ | 登録した概念からクイズを生成 |
| ⚙️ データ管理 | JSON形式でエクスポート/インポート |

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
│  Backend（FastAPI）                                          │
│  /papers  /graph  /chat  /learning-path  /adk-chat          │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│  ADK（Agent Development Kit）                                │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │
│  │ Extraction  │ │   Graph     │ │   Tutor     │            │
│  │   Agent     │ │   Agent     │ │   Agent     │            │
│  └─────────────┘ └─────────────┘ └─────────────┘            │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│  Gemini API（Google AI）                                     │
│  概念抽出・対話・推論・学習パス生成                           │
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
| エージェント | Google ADK | マルチエージェント構成 |
| AI | Gemini API | 概念抽出・対話・推論 |
| デプロイ | Docker + Cloud Run | コンテナデプロイ |

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
│   │   ├── agent.py
│   │   └── tools.py
│   ├── runner.py            # ADK Runner
│   └── orchestrator.py      # エージェント統合
├── api/                     # FastAPI バックエンド
│   ├── main.py              # エントリーポイント
│   ├── db/
│   │   ├── firestore.py     # Firestore連携
│   │   └── vectors.py       # ベクトルストア
│   └── routers/
│       ├── papers.py        # 論文アップロード
│       ├── graph.py         # グラフ操作
│       ├── chat.py          # チャット
│       ├── adk_chat.py      # ADK統合チャット
│       ├── agents.py        # エージェント管理
│       └── learning_path.py # 学習パス生成
├── frontend/                # React フロントエンド
│   └── src/
│       ├── App.tsx          # ルーティング
│       ├── pages/
│       │   ├── HomePage.tsx         # 論文アップロード・要約表示
│       │   ├── PapersPage.tsx       # 論文ライブラリ・比較・AI分析
│       │   ├── GraphPage.tsx        # ナレッジグラフ（階層/タイムライン、論文別色分け）
│       │   ├── ChatPage.tsx         # AIチャット
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
    ├── train.py
    ├── train_lora.py
    └── convert_scierc.py
```

## 🚀 セットアップ

### 環境変数

```bash
cp .env.example .env
# .env を編集して GOOGLE_API_KEY を設定
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

## 📝 提出物（第4回 Agentic AI Hackathon with Google Cloud）

- [ ] GitHubリポジトリ（公開）
- [ ] デプロイURL
- [ ] Zenn記事（4000〜6000字）
  - [ ] プロジェクト概要
  - [ ] システムアーキテクチャ図
  - [ ] デモ動画（3分以内、YouTube）

## 📄 ライセンス

MIT License

## 👤 Author

y.ori