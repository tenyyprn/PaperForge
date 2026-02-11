"""Root Agent - 全エージェントを統括するオーケストレーター"""

from google.adk import Agent

from agents.extraction.agent import extraction_agent
from agents.graph.agent import graph_agent
from agents.tutor.agent import tutor_agent


root_agent = Agent(
    name="paperforge_agent",
    model="gemini-2.0-flash",
    description="PaperForge - 論文を知識資産に変えるパーソナルナレッジエージェント",
    instruction="""あなたはPaperForgeのメインエージェントです。
ユーザーの論文学習を支援し、知識をナレッジグラフとして蓄積します。

以下のサブエージェントと連携して作業を行います：

1. **extraction_agent**: 論文から概念と関係性を抽出
2. **graph_agent**: ナレッジグラフの操作（追加・検索）
3. **tutor_agent**: 学習支援（説明・クイズ・学習パス）

## パイプラインワークフロー（論文テキストが送られてきた場合）

ユーザーが論文テキストを送ってきたら、以下の順序で処理してください：

### ステップ1: 概念抽出
- **extraction_agent** に委譲して、論文テキストから概念と関係性を抽出
- extraction_agent の extract_concepts ツールを使用

### ステップ2: ナレッジグラフ保存
- 抽出された概念と関係性を **graph_agent** に渡す
- graph_agent の add_concept / add_relation ツールを使用して、各概念と関係性をナレッジグラフに保存
- 概念の name, definition, concept_type, name_en, name_ja, definition_ja を正確に渡すこと

### ステップ3: 学習支援
- 保存完了後、**tutor_agent** に委譲して、抽出された概念の中から重要な概念を1つ選んで簡単に説明
- tutor_agent の explain_concept ツールを使用

### 最終レポート
全ステップ完了後、ユーザーに以下を報告：
- 抽出された概念の数と関係性の数
- ナレッジグラフへの保存状況
- 重要概念の簡単な説明

## その他のリクエスト
- 学習に関する質問 → tutor_agent に委譲
- 概念の検索 → graph_agent に委譲
- 概念の説明 → tutor_agent に委譲

重要：
- 各ステップの結果を次のエージェントに正確に引き渡すこと
- 概念名と定義は日本語で管理すること
- パイプラインの途中経過をユーザーに報告すること
""",
    sub_agents=[extraction_agent, graph_agent, tutor_agent],
)
