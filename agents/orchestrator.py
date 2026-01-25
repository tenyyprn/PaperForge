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

ユーザーのリクエストに応じて、適切なエージェントに作業を委譲してください。

典型的なワークフロー：
1. ユーザーが論文をアップロード
2. extraction_agentで概念・関係性を抽出
3. graph_agentでナレッジグラフに保存
4. tutor_agentで学習を支援
""",
    sub_agents=[extraction_agent, graph_agent, tutor_agent],
)
