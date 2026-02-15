---
title: "PaperForge — 論文を『読むだけ』で終わらせない。概念抽出×ナレッジグラフ×AIエージェントで学びを加速する"
emoji: "🔬"
type: "idea"
topics: ["gch4", "vertexai", "googlecloud", "adk", "gemini"]
published: false
---

## はじめに

研究論文を読んで「なるほど」と思っても、1週間後には内容をほとんど忘れている——。大学院生や研究者であれば、誰しも経験があるのではないでしょうか。

論文は読み終えた瞬間がゴールではなく、そこから**自分の知識として定着させるまで**が本当の勝負です。しかし現実には、概念の整理、他の論文との比較、理解度の確認といった「読んだ後」の作業に膨大な時間がかかります。

**PaperForge** は、この課題を解決するために開発した**パーソナルナレッジエージェント**です。論文PDFをアップロードするだけで概念と関係性を自動抽出し、ナレッジグラフとして可視化。AIエージェントとの対話を通じて、理解を深め、学びを加速します。

PaperForgeは「論文 → 概念 → グラフ → 学習」の変換を自動化し、読む時間より**"理解を定着させる時間"を最短化**します。

**GitHub:** https://github.com/tenyyprn/PaperForge

## 対象ユーザーと解決する課題

### 対象ユーザー

- 大量の論文を読む必要がある**大学院生・研究者**
- 新しい分野に参入し、体系的に知識を構築したい**エンジニア・データサイエンティスト**
- 試験や発表前に自分の理解度を客観的に確認したい**学生**

### 解決する課題

論文の読解ワークフローには、以下の「隠れたコスト」が存在します。

| 作業 | 従来の所要時間 | 課題 |
|------|:-:|------|
| 1本の論文の概念整理 | 60〜90分 | 手作業でノートにまとめるしかない |
| 複数論文の横断比較 | 半日〜1日 | 共通点・差分の発見が属人的 |
| 理解度の確認 | 自己申告のみ | 客観的な指標がない |

PaperForgeはこれらの作業を**AIエージェントで自動化**し、論文1本あたりの概念整理を**5〜10分**に短縮します。

※ 上記は一般的な英語論文（機械学習分野）を想定した目安であり、PDFレイアウト・分野の専門性・論文の長さにより変動します。

## 何が新しいのか — 「引用グラフ」から「概念グラフ」へ

既存の論文支援ツール（Connected Papers、Elicit、Research Rabbit 等）は、主に**論文同士の引用ネットワーク**を可視化するものです。これらは「どの論文がどの論文を引用しているか」という外側の関係に注目しており、論文内部の知識構造までは踏み込みません。

PaperForgeのアプローチは根本的に異なります。**論文の内部に踏み込み、"概念（Entity）"と"関係性（Relation）"を自動抽出する**ことで、概念レベルでの横断比較・学習支援まで一気通貫で行います。つまり、「AはBを引用している」ではなく、「論文Aの"Transformer"と論文Bの"Self-Attention"は"構成要素"の関係にある」といった、知識の内部構造を捉えます。

| 観点 | PaperForge | Connected Papers | Elicit | Research Rabbit |
|------|:-:|:-:|:-:|:-:|
| 概念自動抽出 | ◎ | △ | △ | △ |
| ナレッジグラフ | ◎ | ○ | × | ○ |
| セマンティック検索 | ◎ | × | ○ | × |
| マルチエージェント連携 | ◎ | × | × | × |
| 論文比較（AI分析） | ◎ | × | △ | × |
| 学習パス生成 | ◎ | × | × | × |
| 理解度クイズ | ◎ | × | × | × |
| 学習チャット（Tutor Agent） | ◎ | × | ○ | × |

## ソリューションの特徴：9つの機能

PaperForgeは、論文の**アップロードから理解度確認まで**をエンドツーエンドで支援する9つのコア機能を提供します。

### 1. 論文アップロード & 自動解析

PDFをドラッグ&ドロップするだけで、Vertex AI上のGemini 2.0 Flashが論文を解析します。**概念（Entity）と関係性（Relation）を自動抽出**し、起承転結形式の要約を日本語で生成します。抽出される概念にはタイプ（method、dataset、metric等）が付与され、各概念には日英両方の名称と定義が含まれます。英語論文でも日本語で理解できるのが特徴です。

### 2. マルチエージェントパイプライン

アップロード後、ADKの**Orchestrator（Root Agent）**が3つのサブエージェントを自動連携させます。

1. **Extraction Agent** — 論文テキストからGeminiで概念・関係性を抽出
2. **Graph Agent** — 抽出結果をFirestoreのナレッジグラフに自動保存
3. **Tutor Agent** — 重要概念のやさしい説明を自動生成

パイプライン実行中はフロントエンドの**Agent Activity Panel**に各エージェントの活動がリアルタイム表示され、どのエージェントが何をしているかを視覚的に追跡できます。

> （例）`Extraction started → 8 Concepts extracted → Firestore updated → Tutor summary generated`

### 3. ナレッジグラフ（2つのレイアウト）

抽出した概念を`react-force-graph-2d`による**インタラクティブなグラフ**として可視化します。2つのレイアウトモードを用意しています。

- **階層構造レイアウト**: 概念タイプごとに色分けし、関連性をエッジで表現。ノードをクリックすると接続概念がハイライトされる探索モード付き
- **タイムラインレイアウト**: 論文の発表年をX軸に配置し、研究の時間的発展を俯瞰

さらに論文ごとに固有の色を割り当てる**論文別色分け**機能により、どの概念がどの論文由来かを一目で区別できます。複数論文をアップロードすると、概念の重複や関連が視覚的に浮かび上がります。

### 4. セマンティック検索

ナレッジグラフ上で**ベクトル埋め込みによる意味的類似検索**が可能です。キーワード一致ではなく意味的な近さで概念を検索できるため、「Attention」で検索すると「Self-Attention」「Cross-Attention」「Multi-Head Attention」といった関連概念が類似度スコア付きで表示されます。さらに、既存の概念間で未発見の関係性を自動提案する機能も搭載しています。

※ Embeddings は Google の `text-embedding-004`（768次元）+ NumPy によるコサイン類似度で実装しており、将来的に Vertex AI Vector Search への置き換えも可能な設計です。

### 5. 論文ライブラリ & 比較

保存した論文の一覧管理に加え、最大3本の論文を**並列比較**できます。カード形式とテーブル形式を切り替え可能で、共通概念は自動ハイライトされます。

さらに**AI比較分析**機能では、Gemini 2.0 Flashが複数論文を横断的に分析し、手法の違い・貢献度・引用関係の推定・時系列における研究の発展を自動で整理してくれます。「3本の論文を読んで差分をまとめる」という、従来は半日かかっていた作業が数分で完了します。

### 6. 学習チャット（Tutor Agent）

Google ADKで構築した**Tutor Agent**と自然言語で対話しながら学習できます。エージェントは4つのFunctionTool（概念説明・クイズ生成・学習パス提案・関連論文提案）をGeminiのFunction Callingで自律的に選択・実行します。

たとえば「Transformerについて教えて」と入力すると、エージェントが`explain_concept`ツールを呼び出し、初心者向け〜上級者向けの説明を生成します。ユーザーはクイックリプライボタン（「初心者向け」「中級者向け」「上級者向け」）をタップするだけで、詳細度を調整できます。

### 7. 学習パス

登録された概念の依存関係を分析し、**基礎から応用への最適な学習順序**を自動生成します。各ステップには学習理由と前提知識が明示され、効率的な学習計画を立てられます。

### 8. 理解度クイズ

登録した概念から**4択クイズ**を自動生成し、正答率をスコア表示します。学習チャット（Tutor Agent）経由では**3段階の難易度**（かんたん・ふつう・むずかしい）を指定してクイズを生成することも可能です。知識の定着度を客観的に測定できます。

### 9. Firestore永続化

ナレッジグラフと論文データを**Firestore**に保存し、デバイス間での同期を実現しています。Graph Agentがパイプライン中に自動保存するため、ユーザーは保存操作を意識する必要がありません。Firestore未設定時はブラウザのLocalStorage（Zustand persist）にフォールバックするため、環境を問わず動作します。データは `users/{userId}/papers`, `users/{userId}/concepts`, `users/{userId}/relations` のコレクション構造で保持します。

## システムアーキテクチャ

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend（React + TypeScript + Vite）                       │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐     │
│  │ Home │ │Papers│ │Graph │ │ Path │ │ Quiz │ │ Chat │     │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘     │
│  Zustand（永続化ストア）+ Agent Activity Panel               │
└─────────────────────┬───────────────────────────────────────┘
                      │ REST API + SSE（Server-Sent Events）
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

### 技術スタック

| レイヤー | 技術 | 役割 |
|----------|------|------|
| フロントエンド | React + TypeScript + Vite | SPA UI |
| 状態管理 | Zustand (persist) | グラフ・論文データのローカル永続化 |
| 可視化 | react-force-graph-2d + Canvas API | ナレッジグラフ描画 |
| バックエンド | FastAPI + Uvicorn | REST API + SSE ストリーミング |
| データベース | **Firestore** | 概念・関係性・論文データの永続化 |
| ベクトル検索 | Embeddings + コサイン類似度 | セマンティック検索・関係性提案 |
| エージェント | **Google ADK** (Runner + FunctionTool) | マルチエージェントオーケストレーション |
| AI | **Vertex AI** (Gemini 2.0 Flash) | 概念抽出・対話・推論 |
| デプロイ | Docker + **Cloud Run** (asia-northeast1) | コンテナデプロイ |

## ADKによるエージェント設計

PaperForgeの中核は、Google **ADK（Agent Development Kit）** を活用したマルチエージェントアーキテクチャです。

### Orchestrator（Root Agent）によるパイプライン

ADKの`sub_agents`機能を活用し、Root Agentが3つのサブエージェントを統括するオーケストレーション構成を採用しています。

```python
from google.adk import Agent

root_agent = Agent(
    name="paperforge_agent",
    model="gemini-2.0-flash",
    description="PaperForge - 論文を知識資産に変えるパーソナルナレッジエージェント",
    instruction="""以下のサブエージェントと連携して作業を行います：
    1. extraction_agent: 論文から概念と関係性を抽出
    2. graph_agent: ナレッジグラフの操作（Firestoreへの保存・検索）
    3. tutor_agent: 学習支援（説明・クイズ・学習パス）
    ...""",
    sub_agents=[extraction_agent, graph_agent, tutor_agent],
)
```

Root Agentは論文テキストを受け取ると、ADKのネイティブな委譲機能を使って各サブエージェントに順次タスクを委譲します。各エージェント間のデータ引き渡し（抽出結果 → 保存 → 説明生成）もRoot Agentが自律的に管理します。Root Agent は「抽出 → 保存 → 学習支援」の順序を保証し、各ステップの完了イベントを監視して次のサブエージェントに委譲します。

### 各エージェントの FunctionTool

```python
# Extraction Agent — Gemini APIで概念を抽出
extraction_agent = Agent(
    name="extraction_agent",
    tools=[FunctionTool(extract_concepts), FunctionTool(extract_relations)],
)

# Graph Agent — Firestoreに保存・検索
graph_agent = Agent(
    name="graph_agent",
    tools=[FunctionTool(add_concept), FunctionTool(add_relation),
           FunctionTool(search_concepts), FunctionTool(get_related_concepts)],
)

# Tutor Agent — 学習支援
tutor_agent = Agent(
    name="tutor_agent",
    tools=[FunctionTool(explain_concept), FunctionTool(generate_quiz),
           FunctionTool(generate_learning_path), FunctionTool(suggest_related_papers)],
)
```

ADK の `Runner` を使うことで、セッション管理・ツール選択・実行を**フレームワーク側に委譲**できます。エージェントはユーザーの意図を解釈し、FunctionToolから最適なものを自律的に選択・実行します。

### パイプライン実行とイベント監視

```python
runner = Runner(
    agent=root_agent,
    app_name="paperforge",
    session_service=InMemorySessionService(),
)

# パイプライン実行（非同期イベントストリーム）
async for event in runner.run_async(
    user_id=user_id,
    session_id=session_id,
    new_message=f"以下の論文を処理してください：{text}",
):
    # イベントからエージェント名・ツール呼び出しを抽出
    # → Agent Activity Panel にリアルタイム表示
```

`runner.run_async()` が返すイベントストリームから、どのエージェントが何のツールを呼んでいるかをリアルタイムに取得します。取得したアクティビティはサーバー側の `_sessions` dictに蓄積され、フロントエンドは **SSE（Server-Sent Events）** エンドポイント（`GET /api/agents/stream/{session_id}`）を通じて活動ログをリアルタイムに受信・表示します。

## Cloud RunとVertex AIの構成

### リージョン設計

Cloud Runは低レイテンシのために `asia-northeast1`（東京）にデプロイしています。一方、Gemini 2.0 FlashのVertex AIエンドポイントは `us-central1` を使用しています（モデル提供リージョンの制約）。

```python
# 環境変数でリージョンを管理
location = os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1")
client = genai.Client(vertexai=True, project=project, location=location)
```

### レート制限対策

Vertex AIへのAPI呼び出しには、エクスポネンシャルバックオフ付きリトライを実装しています。

```python
def _call_with_retry(client, **kwargs) -> str:
    for attempt in range(3):
        try:
            response = client.models.generate_content(**kwargs)
            return response.text
        except Exception as e:
            if ("429" in str(e) or "RESOURCE_EXHAUSTED" in str(e)) and attempt < 2:
                time.sleep(2 ** attempt)
                continue
            raise
```

## 🎬 デモ動画（3分）

PaperForge の実際の動作を 3 分で紹介したデモ動画です。

@[youtube](zGGpBHW7ENM)

### デモで紹介している内容

1. 論文アップロード
2. 日本語訳、自動解析
3. マルチエージェントパイプライン
4. ナレッジ抽出、ナレッジグラフ
5. セマンティック検索
6. 学習AIチャット機能
7. 学習パス
8. クイズAI生成

## 開発で工夫した点

### ADKのFunctionToolとJSON文字列の扱い

ADK経由でツールが呼ばれる場合、引数はJSON文字列として渡されますが、FastAPI経由の直接呼び出しではPythonのlistが渡されます。この差異を吸収するため、各ツール関数の冒頭で型チェックを行っています。

```python
def generate_quiz(concepts: str, ...) -> dict:
    # ADK経由ではJSON文字列、直接呼び出しではlistが渡される
    if isinstance(concepts, str):
        concepts = json.loads(concepts)
```

### Graph AgentのFirestore同期API

ADKのFunctionToolは**同期関数**として呼ばれるため、Graph Agentのツール内ではFirestoreの非同期クライアント（`AsyncClient`）ではなく**同期クライアント（`Client`）** を直接使用しています。FastAPIの非同期ルーターとは独立した設計にすることで、ADK経由でもAPI経由でもシームレスに動作します。

```python
def add_concept(name: str, definition: str, ...) -> dict:
    db = firestore.Client(project=project_id)  # 同期API
    doc_ref = db.collection("users").document(user_id).collection("concepts").document(id)
    doc_ref.set(concept_data)
```

### クイックリプライによるUX改善

Tutor Agentが「beginner / intermediate / advanced」のような選択肢を提示した場合、フロントエンドがそれを検出し、ワンタップで回答できるクイックリプライボタンを動的に生成します。チャットUIとしての操作性を大幅に向上させています。

## 今後の展望

- **Gemma LoRA**: 概念抽出タスクに特化したファインチューニングモデルの導入で、Gemini依存から脱却し抽出精度を向上
- **共同ナレッジグラフ**: 複数ユーザーが同一のナレッジグラフを共有・編集し、研究チームでの知識共有を実現
- **論文推薦**: 蓄積したナレッジグラフの空白領域を分析し、次に読むべき論文を自動推薦

## まとめ

PaperForgeは、論文を「読むだけ」で終わらせず、**概念の抽出 → ナレッジグラフ保存 → セマンティック検索 → 比較 → 学習パス →クイズ**という一連のワークフローをマルチエージェントパイプラインで一気通貫に支援するツールです。

ADKのOrchestratorによる3エージェント連携、Firestoreによるデータ永続化、ベクトル埋め込みによるセマンティック検索——これらをVertex AI（Gemini 2.0 Flash）の推論能力とCloud Runのスケーラブルなデプロイで結合し、「論文から知識資産へ」の変換を実現しました。

論文を読む全ての人にとって、PaperForgeが学びのパートナーとなれば幸いです。

ぜひ実際に論文をアップロードして、概念が自動抽出されナレッジグラフとして広がっていく体験をお試しください。フィードバックやご意見はGitHubのIssueでお待ちしています。

**PaperForgeは、論文理解を"作業"から"対話型の学習体験"へ変えるための、パーソナル学習OSです。**
