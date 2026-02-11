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

| 機能 | 説明 | Status |
|------|------|:------:|
| 📄 論文アップロード | PDFをアップロードして概念・関係性を自動抽出。起承転結の要約を日本語で生成 | Stable |
| 🤖 マルチエージェントパイプライン | アップロード後、Extraction → Graph → Tutor Agent が自動連携。抽出から学習支援まで完全自動化 | Stable |
| 🕸️ ナレッジグラフ | 抽出した概念を階層構造で可視化。探索モードで接続概念をハイライト | Stable |
| 🔍 セマンティック検索 | ベクトル埋め込みによる意味的類似検索。類似概念の発見と関係性の自動提案 | Stable |
| 📅 タイムラインビュー | 論文の発表年に基づいてX軸に時系列配置。研究の発展を時間軸で俯瞰 | Stable |
| 🎨 論文別色分け | 各論文に固有の色を割り当て、概念の由来論文を視覚的に区別 | Stable |
| 📚 論文ライブラリ | 保存した論文の一覧管理。要約・抽出概念・起承転結をいつでも確認 | Stable |
| 🔀 論文比較 | 最大3本の論文を並列比較（カード/テーブル）。共通概念のハイライト | Stable |
| 🤖 AI比較分析 | 論文の優劣・手法・貢献度に加え、引用関係の推定・時系列の発展を自動分析 | Stable |
| 💬 学習チャット | ADK Tutor Agentと対話して知識を深める。クイックリプライで直感的に操作 | Stable |
| 🗺️ 学習パス | 概念の依存関係を考慮した最適な学習順序を自動生成。進捗も永続化 | Stable |
| ❓ 理解度クイズ | 登録した概念から難易度別クイズを生成。スコア表示で理解度を可視化 | Stable |
| 🔥 Firestore永続化 | ナレッジグラフと論文データをFirestoreに保存。デバイス間同期に対応 | Stable |
| ⚙️ データ管理 | JSON形式でエクスポート/インポート（学習パス含む） | Stable |

## 🎥 デモシナリオ

1. **論文アップロード** — PDFをドラッグ&ドロップ
2. **自動解析** — 概念・関係性を抽出、起承転結の要約を日本語で生成
3. **マルチエージェントパイプライン** — Extraction → Graph → Tutor Agent が自動連携、活動をリアルタイム表示
4. **ナレッジグラフ** — 抽出した概念をインタラクティブに可視化、セマンティック検索で類似概念を発見
5. **論文比較** — 3本の論文をカード/テーブル/AI分析で比較
6. **学習パス生成** — 概念の依存関係から最適な学習順序を提案
7. **クイズで理解度チェック** — 登録概念から自動生成されたクイズに挑戦

## 📈 期待効果（目安）

| 指標 | 従来ワークフロー | PaperForge利用時 |
|------|:----------------:|:----------------:|
| 論文1本の概念整理 | 60〜90 分 | **5〜10 分**（自動抽出） |
| 3本の横断比較 | 半日〜1日 | **数分**（AI比較分析） |
| 知識の抜け漏れ発見 | 自己申告のみ | **クイズ＋グラフで定量化** |

※ 上記は一般的な英語論文（機械学習分野）を想定した目安であり、PDFレイアウトや分野・専門性により変動します。

> **Novelty — 何が新しいか:**
> 既存ツール（Connected Papers, Elicit 等）が *論文同士の引用ネットワーク* に留まるのに対し、PaperForge は **論文内部の"概念"を自動抽出し、マルチエージェントパイプラインで概念レベルの横断・比較・セマンティック検索・学習支援まで一気通貫で行う** 点が新しい。

## 🔍 既存ツールとの違い

| 観点 | PaperForge | Connected Papers | Elicit | Research Rabbit |
|------|:----------:|:----------------:|:------:|:---------------:|
| 概念自動抽出 | ◎ | △ | △ | △ |
| ナレッジグラフ | ◎ | ○ | × | ○ |
| セマンティック検索 | ◎ | × | ○ | × |
| マルチエージェント連携 | ◎ | × | × | × |
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
│  Zustand（永続化ストア）+ Agent Activity Panel               │
└─────────────────────┬───────────────────────────────────────┘
                      │ REST API
┌─────────────────────▼───────────────────────────────────────┐
│  Backend（FastAPI + Cloud Run）                               │
│  /papers  /graph  /chat  /learning-path  /adk  /agents      │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│  ADK（Agent Development Kit）                                │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐     │
│  │         Orchestrator（Root Agent）                   │     │
│  │  論文テキスト → 抽出 → 保存 → 学習支援 を統括      │     │
│  └──────────┬──────────┬──────────┬─────────────────────┘     │
│             │          │          │                           │
│  ┌──────────▼───┐ ┌────▼────────┐ ┌▼─────────────┐          │
│  │ Extraction  │ │   Graph     │ │   Tutor     │            │
│  │   Agent     │ │   Agent     │ │   Agent     │            │
│  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘            │
│         │  FunctionTool  │  FunctionTool │  FunctionTool     │
│  ┌──────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐            │
│  │ 概念抽出    │ │ グラフ操作  │ │ 説明/クイズ │            │
│  │ 関係抽出    │ │ Firestore   │ │ 学習パス    │            │
│  └─────────────┘ └──────┬──────┘ └─────────────┘            │
└─────────────────────────┼───────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
┌───────▼───────┐ ┌───────▼───────┐ ┌───────▼───────┐
│  Vertex AI    │ │  Firestore    │ │ Vector Store  │
│ Gemini 2.0    │ │ 概念・関係    │ │ Embeddings    │
│  Flash        │ │ 論文データ    │ │ セマンティック │
└───────────────┘ └───────────────┘ └───────────────┘
```

> **Vector Store** は現在 自前Embeddings + コサイン類似度 で実装。将来的に Vertex AI Vector Search への差し替えも検討中。

## 🤖 マルチエージェントパイプライン

論文アップロード後、ADK の Orchestrator（Root Agent）が 3つのサブエージェントを自動連携させます。

```
📄 論文PDF → [Extraction Agent] → [Graph Agent] → [Tutor Agent] → 📊 学習支援
                  │                    │                 │
                  ▼                    ▼                 ▼
           概念・関係性を        Firestoreに         重要概念の
           Geminiで抽出        ナレッジグラフ保存    やさしい説明を生成
```

| エージェント | 役割 | FunctionTools |
|-------------|------|---------------|
| Extraction Agent | 論文テキストから概念・関係性・要約を抽出 | `extract_concepts`, `extract_relations` |
| Graph Agent | 抽出結果をFirestoreのナレッジグラフに保存・検索 | `add_concept`, `add_relation`, `search_concepts`, `get_related_concepts` |
| Tutor Agent | 概念の説明、クイズ生成、学習パス提案 | `explain_concept`, `generate_quiz`, `generate_learning_path`, `suggest_related_papers` |

パイプライン実行中のエージェント活動はフロントエンドの **Agent Activity Panel** にリアルタイム表示されます。

```
[Activity Panel の表示例]
🔬 Extraction Agent  — extract_concepts を実行中...      [thinking]
🔬 Extraction Agent  — 8個の概念と5個の関係性を抽出      [completed]
📊 Graph Agent       — add_concept「Transformer」を保存   [completed]
📊 Graph Agent       — add_relation を保存                [completed]
🎓 Tutor Agent       — explain_concept を実行中...        [thinking]
🎓 Tutor Agent       — 重要概念の説明を生成               [completed]
```

## 🛠️ 技術スタック

| レイヤー | 技術 | 役割 |
|----------|------|------|
| フロントエンド | React + TypeScript + Vite | SPA UI |
| 状態管理 | Zustand (persist) | グラフ・論文データのローカル永続化 |
| 可視化 | react-force-graph-2d + Canvas API | ナレッジグラフ描画（階層/タイムラインレイアウト） |
| バックエンド | FastAPI + Uvicorn | REST API |
| データベース | Firestore | 概念・関係性・論文データの永続化（デバイス間同期） |
| ベクトル検索 | Embeddings + コサイン類似度 | セマンティック検索・類似概念発見・関係性提案 |
| エージェント | Google ADK (Runner + FunctionTool) | マルチエージェントオーケストレーション |
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
│   ├── extraction/          # 概念抽出Agent（Gemini APIで概念・関係性を抽出）
│   │   ├── agent.py
│   │   └── tools.py         # extract_concepts, extract_relations
│   ├── graph/               # グラフ操作Agent（Firestoreへの保存・検索）
│   │   ├── agent.py
│   │   └── tools.py         # add_concept, add_relation, search_concepts
│   ├── tutor/               # 学習支援Agent
│   │   ├── agent.py         # ADK Agent定義（gemini-2.0-flash）
│   │   └── tools.py         # explain_concept, generate_quiz, etc.
│   ├── runner.py            # ADK Runner ラッパー
│   └── orchestrator.py      # Root Agent（3エージェントをオーケストレーション）
├── api/                     # FastAPI バックエンド
│   ├── main.py              # エントリーポイント
│   ├── db/
│   │   ├── firestore.py     # Firestore連携（概念・関係・論文の永続化）
│   │   └── vectors.py       # ベクトルストア（セマンティック検索用）
│   └── routers/
│       ├── papers.py        # 論文アップロード・概念抽出
│       ├── graph.py         # グラフCRUD + セマンティック検索 + 関係性提案
│       ├── chat.py          # チャット（Function Calling）
│       ├── adk_chat.py      # ADK Runner統合チャット
│       ├── agents.py        # エージェント管理 + パイプライン実行
│       └── learning_path.py # 学習パス生成
├── frontend/                # React フロントエンド
│   └── src/
│       ├── App.tsx          # ルーティング
│       ├── pages/
│       │   ├── HomePage.tsx         # 論文アップロード・要約表示・パイプライン実行
│       │   ├── PapersPage.tsx       # 論文ライブラリ・比較・AI分析
│       │   ├── GraphPage.tsx        # ナレッジグラフ（階層/タイムライン、セマンティック検索）
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

- [x] デプロイURL: https://paperforge-740219973201.asia-northeast1.run.app
- [x] GitHubリポジトリ
- [ ] Zenn記事（4000〜6000字）
  - [ ] プロジェクト概要
  - [ ] システムアーキテクチャ図
  - [ ] デモ動画（3分以内、YouTube）

## ⚠️ 注意事項

- 概念抽出の精度は Gemini 2.0 Flash の出力に依存します。専門性の高い論文では手動補正が必要な場合があります
- Firestore 未設定の場合、データはブラウザの LocalStorage（Zustand persist）に保存されます。Firestore を設定するとデバイス間でデータが同期されます
- Vertex AI の利用には Google Cloud の課金アカウントが必要です
- マルチエージェントパイプラインは ADK Runner を使用しており、初回実行時にセッション初期化のための遅延が発生する場合があります

## 📄 ライセンス

MIT License

## 👤 Author

y.ori
