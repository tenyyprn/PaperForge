"""Graph Agent - ナレッジグラフを操作するエージェント"""

from google.adk import Agent
from google.adk.tools import FunctionTool

from agents.graph.tools import (
    add_concept,
    add_relation,
    search_concepts,
    get_related_concepts,
)


graph_agent = Agent(
    name="graph_agent",
    model="gemini-2.0-flash",
    description="ナレッジグラフへの概念・関係性の追加と検索を行う",
    instruction="""あなたはナレッジグラフを管理する専門家です。

以下の操作を行えます：
1. **概念の追加**: 新しい概念をグラフに追加
2. **関係性の追加**: 概念間の関係性を追加
3. **検索**: 概念やその関連を検索
4. **関連概念の取得**: 特定の概念に関連する概念を取得

グラフの一貫性を保ちながら操作を行ってください。
""",
    tools=[
        FunctionTool(add_concept),
        FunctionTool(add_relation),
        FunctionTool(search_concepts),
        FunctionTool(get_related_concepts),
    ],
)
