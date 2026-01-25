"""Extraction Agent - 論文から概念と関係性を抽出するエージェント"""

from google.adk import Agent
from google.adk.tools import FunctionTool

from agents.extraction.tools import extract_concepts, extract_relations


extraction_agent = Agent(
    name="extraction_agent",
    model="gemini-2.0-flash",
    description="論文テキストから概念（Concept）と関係性（Relation）を抽出する",
    instruction="""あなたは論文から知識を抽出する専門家です。

与えられた論文テキストから以下を抽出してください：
1. **概念（Concepts）**: 論文で定義・説明されている重要な用語や概念
2. **関係性（Relations）**: 概念間の関係（例: is-a, part-of, causes, uses, etc.）

出力は構造化されたJSON形式で返してください。
""",
    tools=[
        FunctionTool(extract_concepts),
        FunctionTool(extract_relations),
    ],
)
