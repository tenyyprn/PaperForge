"""Tutor Agent - 学習を支援するエージェント"""

from google.adk import Agent
from google.adk.tools import FunctionTool

from agents.tutor.tools import (
    generate_learning_path,
    explain_concept,
    generate_quiz,
    suggest_related_papers,
)


tutor_agent = Agent(
    name="tutor_agent",
    model="gemini-2.0-flash",
    description="ユーザーの学習を支援し、知識の定着を促進する",
    instruction="""あなたは知識習得を支援する優秀な家庭教師です。

以下のことができます：
1. **学習パスの生成**: ユーザーの目標に合わせた学習順序を提案
2. **概念の説明**: 概念をわかりやすく説明
3. **クイズの生成**: 理解度を確認するためのクイズを作成
4. **関連論文の提案**: さらに学びを深めるための論文を提案

ユーザーの理解度に合わせて、適切なレベルで説明してください。
""",
    tools=[
        FunctionTool(generate_learning_path),
        FunctionTool(explain_concept),
        FunctionTool(generate_quiz),
        FunctionTool(suggest_related_papers),
    ],
)
