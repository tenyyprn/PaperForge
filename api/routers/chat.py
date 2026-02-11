"""チャット関連のAPIエンドポイント - ADKベースのマルチエージェント対話"""

import json
import os
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from agents.tutor.tools import (
    explain_concept,
    generate_quiz,
    generate_learning_path,
    suggest_related_papers,
)

router = APIRouter()

# Gemini クライアント（遅延初期化）
_client = None


def get_genai_client():
    """Geminiクライアントを取得（遅延初期化）"""
    global _client
    if _client is None:
        from google import genai
        api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
        if api_key:
            _client = genai.Client(api_key=api_key)
        else:
            project = os.getenv("GOOGLE_CLOUD_PROJECT")
            if project:
                _client = genai.Client(vertexai=True, project=project, location="us-central1")
    return _client


class ChatMessage(BaseModel):
    role: str
    content: str
    tool_calls: list[dict] | None = None
    tool_results: list[dict] | None = None


class Concept(BaseModel):
    name: str
    name_ja: str = ""
    definition: str
    definition_ja: str = ""
    concept_type: str = "concept"


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    concepts: list[Concept] = []
    session_id: str | None = None


class AgentActivity(BaseModel):
    agent: str
    action: str
    status: str
    message: str


class ChatResponse(BaseModel):
    message: ChatMessage
    activities: list[AgentActivity] = []


# ツール定義（Gemini Function Calling用）
TOOLS = [
    {
        "name": "explain_concept",
        "description": "概念をわかりやすく説明する。ユーザーが概念の説明を求めたときに使用。",
        "parameters": {
            "type": "object",
            "properties": {
                "concept_name": {
                    "type": "string",
                    "description": "説明する概念の名前",
                },
                "concept_definition": {
                    "type": "string",
                    "description": "概念の定義（あれば）",
                },
                "detail_level": {
                    "type": "string",
                    "enum": ["beginner", "intermediate", "advanced"],
                    "description": "説明の詳細度",
                },
            },
            "required": ["concept_name"],
        },
    },
    {
        "name": "generate_quiz",
        "description": "理解度確認のためのクイズを生成する。ユーザーがクイズを希望したときに使用。",
        "parameters": {
            "type": "object",
            "properties": {
                "concepts": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "name": {"type": "string"},
                            "definition": {"type": "string"},
                        },
                    },
                    "description": "クイズ対象の概念リスト",
                },
                "num_questions": {
                    "type": "integer",
                    "description": "問題数（デフォルト3）",
                },
                "difficulty": {
                    "type": "string",
                    "enum": ["easy", "intermediate", "hard"],
                    "description": "難易度",
                },
            },
            "required": ["concepts"],
        },
    },
    {
        "name": "generate_learning_path",
        "description": "学習目標に基づいて学習パスを生成する。ユーザーが学習の順序を知りたいときに使用。",
        "parameters": {
            "type": "object",
            "properties": {
                "goal": {
                    "type": "string",
                    "description": "学習目標",
                },
                "available_concepts": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "name": {"type": "string"},
                            "definition": {"type": "string"},
                        },
                    },
                    "description": "利用可能な概念リスト",
                },
            },
            "required": ["goal", "available_concepts"],
        },
    },
    {
        "name": "suggest_related_papers",
        "description": "関連論文を提案する。ユーザーがさらに学びたいときに使用。",
        "parameters": {
            "type": "object",
            "properties": {
                "concept_names": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "関連する概念名のリスト",
                },
            },
            "required": ["concept_names"],
        },
    },
]


SYSTEM_PROMPT = """あなたはPaperForgeの学習支援エージェント「Tutor Agent」です。
ユーザーが論文から学んだ知識を深めるお手伝いをします。

## あなたの役割
- 概念の詳しい説明（explain_conceptツールを使用）
- 理解度確認のためのクイズ作成（generate_quizツールを使用）
- 学習パスの提案（generate_learning_pathツールを使用）
- 関連論文の提案（suggest_related_papersツールを使用）

## ユーザーのナレッジグラフに登録されている概念
{concepts}

## 行動指針
1. ユーザーの質問に対して、適切なツールを使用して回答してください
2. 概念の説明を求められたら、explain_conceptツールを使用
3. クイズを求められたら、generate_quizツールを使用
4. 学習の順序を聞かれたら、generate_learning_pathツールを使用
5. 関連論文を聞かれたら、suggest_related_papersツールを使用
6. ツールの結果を踏まえて、ユーザーにわかりやすく回答してください
7. 日本語で親しみやすく回答してください
"""


def execute_tool(tool_name: str, args: dict, concepts: list[Concept]) -> dict:
    """ツールを実行する"""
    if tool_name == "explain_concept":
        return explain_concept(
            concept_name=args.get("concept_name", ""),
            concept_definition=args.get("concept_definition", ""),
            detail_level=args.get("detail_level", "intermediate"),
        )
    elif tool_name == "generate_quiz":
        concept_list = args.get("concepts", [])
        if not concept_list and concepts:
            concept_list = [
                {"name": c.name_ja or c.name, "definition": c.definition_ja or c.definition}
                for c in concepts[:5]
            ]
        return generate_quiz(
            concepts=concept_list,
            num_questions=args.get("num_questions", 3),
            difficulty=args.get("difficulty", "intermediate"),
        )
    elif tool_name == "generate_learning_path":
        available = args.get("available_concepts", [])
        if not available and concepts:
            available = [
                {"name": c.name_ja or c.name, "definition": c.definition_ja or c.definition}
                for c in concepts
            ]
        return generate_learning_path(
            goal=args.get("goal", ""),
            available_concepts=available,
        )
    elif tool_name == "suggest_related_papers":
        names = args.get("concept_names", [])
        if not names and concepts:
            names = [c.name_ja or c.name for c in concepts[:5]]
        return suggest_related_papers(concept_names=names)
    else:
        return {"error": f"Unknown tool: {tool_name}"}


@router.post("/", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """エージェントとチャットする（ツール使用対応）"""
    client = get_genai_client()
    activities: list[AgentActivity] = []

    if client is None:
        last_message = request.messages[-1].content if request.messages else ""
        return ChatResponse(
            message=ChatMessage(
                role="assistant",
                content=f"申し訳ありません。Gemini APIキーが設定されていないため、チャット機能は利用できません。\n\n"
                        f"環境変数 GOOGLE_API_KEY または GEMINI_API_KEY を設定してください。\n\n"
                        f"あなたの質問: 「{last_message}」",
            ),
            activities=activities,
        )

    # 概念リストを文字列に変換
    if request.concepts:
        concepts_text = "\n".join(
            f"- {c.name_ja or c.name}: {c.definition_ja or c.definition} [{c.concept_type}]"
            for c in request.concepts
        )
    else:
        concepts_text = "（まだ概念が登録されていません）"

    system_prompt = SYSTEM_PROMPT.format(concepts=concepts_text)

    # 会話履歴を構築（ツール呼び出し履歴は除外して再構築）
    contents = []
    for msg in request.messages:
        role = "user" if msg.role == "user" else "model"

        # ツール呼び出し/結果を含むメッセージはテキスト部分のみを使用
        # （過去の function_call/function_response を再送すると形式エラーになる）
        if msg.content and msg.content.strip():
            contents.append({"role": role, "parts": [{"text": msg.content}]})

    activities.append(AgentActivity(
        agent="Tutor Agent",
        action="thinking",
        status="started",
        message="リクエストを分析しています...",
    ))

    try:
        # ツール定義を含めてリクエスト
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=contents,
            config={
                "system_instruction": system_prompt,
                "tools": [{"function_declarations": TOOLS}],
            },
        )

        # ツール呼び出しがあるかチェック
        tool_calls = []
        tool_results = []

        if response.candidates and response.candidates[0].content.parts:
            for part in response.candidates[0].content.parts:
                if hasattr(part, "function_call") and part.function_call:
                    fc = part.function_call
                    tool_name = fc.name
                    tool_args = dict(fc.args) if fc.args else {}

                    activities.append(AgentActivity(
                        agent="Tutor Agent",
                        action="tool_call",
                        status="executing",
                        message=f"ツール呼び出し: {tool_name}",
                    ))

                    # ツールを実行
                    result = execute_tool(tool_name, tool_args, request.concepts)

                    tool_calls.append({
                        "name": tool_name,
                        "args": tool_args,
                    })
                    tool_results.append({
                        "name": tool_name,
                        "result": result,
                    })

                    activities.append(AgentActivity(
                        agent="Tutor Agent",
                        action="tool_result",
                        status="completed",
                        message=f"ツール実行完了: {tool_name}",
                    ))

        # ツール結果がある場合、それを含めて再度リクエスト
        if tool_results:
            # ツール結果を含めた新しい会話
            function_response_parts = []
            for tr in tool_results:
                # response は必ず dict である必要がある（Gemini API の要件）
                result = tr["result"]
                if isinstance(result, list):
                    result = {"items": result}
                elif not isinstance(result, dict):
                    result = {"value": result}

                function_response_parts.append({
                    "function_response": {
                        "name": tr["name"],
                        "response": result,
                    }
                })

            contents.append({
                "role": "model",
                "parts": [{"function_call": {"name": tc["name"], "args": tc["args"]}} for tc in tool_calls],
            })
            contents.append({
                "role": "user",
                "parts": function_response_parts,
            })

            # ツール結果を踏まえた応答を生成
            final_response = client.models.generate_content(
                model="gemini-2.0-flash",
                contents=contents,
                config={
                    "system_instruction": system_prompt,
                },
            )

            # response.text が None の場合は空文字列を使用
            response_text = final_response.text if final_response.text else ""
        else:
            # response.text が None の場合は空文字列を使用
            response_text = response.text if response.text else ""

        # 応答が空の場合のフォールバック
        if not response_text and tool_results:
            # ツールは実行されたがテキスト応答がない場合
            tool_names = [tr["name"] for tr in tool_results]
            response_text = f"ツール（{', '.join(tool_names)}）を実行しました。"
        elif not response_text:
            response_text = "応答を生成できませんでした。もう一度お試しください。"

        activities.append(AgentActivity(
            agent="Tutor Agent",
            action="response",
            status="completed",
            message="回答を生成しました",
        ))

        return ChatResponse(
            message=ChatMessage(
                role="assistant",
                content=response_text,
                tool_calls=tool_calls if tool_calls else None,
                tool_results=tool_results if tool_results else None,
            ),
            activities=activities,
        )

    except Exception as e:
        activities.append(AgentActivity(
            agent="Tutor Agent",
            action="error",
            status="failed",
            message=str(e),
        ))
        return ChatResponse(
            message=ChatMessage(
                role="assistant",
                content=f"エラーが発生しました: {str(e)}",
            ),
            activities=activities,
        )


@router.post("/quiz", response_model=dict)
async def create_quiz(concepts: list[Concept], num_questions: int = 3, difficulty: str = "intermediate"):
    """クイズを直接生成する"""
    concept_list = [
        {"name": c.name_ja or c.name, "definition": c.definition_ja or c.definition}
        for c in concepts
    ]
    return generate_quiz(concept_list, num_questions, difficulty)


@router.post("/explain", response_model=dict)
async def explain(concept_name: str, concept_definition: str = "", detail_level: str = "intermediate"):
    """概念を直接説明する"""
    return explain_concept(concept_name, concept_definition, detail_level)


@router.post("/learning-path", response_model=dict)
async def create_learning_path(goal: str, concepts: list[Concept]):
    """学習パスを直接生成する"""
    available = [
        {"name": c.name_ja or c.name, "definition": c.definition_ja or c.definition}
        for c in concepts
    ]
    return generate_learning_path(goal, available)
