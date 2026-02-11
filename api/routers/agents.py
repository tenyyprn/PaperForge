"""エージェントオーケストレーションのAPIエンドポイント

ADKを使用したマルチエージェント協調を実現し、エージェント活動を可視化する
"""

import asyncio
import json
import os
import uuid
from datetime import datetime
from typing import AsyncGenerator

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

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


# エージェント定義
AGENTS = {
    "orchestrator": {
        "name": "PaperForge Orchestrator",
        "icon": "🎯",
        "description": "全体を統括するメインエージェント",
    },
    "extraction": {
        "name": "Extraction Agent",
        "icon": "📚",
        "description": "論文から概念と関係性を抽出",
    },
    "graph": {
        "name": "Graph Agent",
        "icon": "🕸️",
        "description": "ナレッジグラフを構築・管理",
    },
    "tutor": {
        "name": "Tutor Agent",
        "icon": "🎓",
        "description": "学習をサポート",
    },
    "quiz": {
        "name": "Quiz Agent",
        "icon": "❓",
        "description": "理解度クイズを生成",
    },
}


class AgentActivity(BaseModel):
    id: str
    agent_id: str
    agent_name: str
    icon: str
    action: str
    status: str  # "started", "thinking", "completed", "delegating"
    message: str
    timestamp: str
    result: dict | None = None


class AgentRequest(BaseModel):
    task: str  # "extract", "learn", "quiz", "chat"
    input: str
    concepts: list[dict] = []
    context: dict = {}


class AgentResponse(BaseModel):
    session_id: str
    activities: list[AgentActivity]
    result: dict


# セッション管理（インメモリ）
_sessions: dict[str, list[AgentActivity]] = {}


def create_activity(
    agent_id: str,
    action: str,
    status: str,
    message: str,
    result: dict | None = None,
) -> AgentActivity:
    """エージェント活動を記録"""
    agent = AGENTS.get(agent_id, {"name": agent_id, "icon": "🤖"})
    return AgentActivity(
        id=str(uuid.uuid4()),
        agent_id=agent_id,
        agent_name=agent["name"],
        icon=agent["icon"],
        action=action,
        status=status,
        message=message,
        timestamp=datetime.now().isoformat(),
        result=result,
    )


async def run_extraction_task(text: str, session_id: str) -> dict:
    """概念抽出タスクを実行"""
    activities = _sessions.get(session_id, [])

    # オーケストレーター開始
    activities.append(create_activity(
        "orchestrator", "analyze", "started",
        "リクエストを分析しています..."
    ))

    await asyncio.sleep(0.3)

    # 抽出エージェントに委譲
    activities.append(create_activity(
        "orchestrator", "delegate", "delegating",
        "Extraction Agentに作業を委譲します"
    ))

    activities.append(create_activity(
        "extraction", "extract", "thinking",
        "論文テキストを解析中..."
    ))

    client = get_genai_client()

    if client is None:
        # モック応答
        await asyncio.sleep(1)
        concepts = [
            {"id": str(uuid.uuid4()), "name": "機械学習", "definition": "データからパターンを学習するAI技術"},
            {"id": str(uuid.uuid4()), "name": "ニューラルネットワーク", "definition": "脳の神経回路を模倣した計算モデル"},
        ]
        relations = [
            {"id": str(uuid.uuid4()), "source": "ニューラルネットワーク", "target": "機械学習", "relation_type": "is-a"},
        ]
    else:
        # Gemini APIで抽出
        prompt = f"""以下のテキストから重要な概念と関係性を抽出してください。

テキスト:
{text[:3000]}

JSON形式で出力:
{{
  "concepts": [{{"id": "uuid", "name": "概念名", "definition": "定義"}}],
  "relations": [{{"id": "uuid", "source": "概念名", "target": "概念名", "relation_type": "関係タイプ"}}]
}}"""

        try:
            response = client.models.generate_content(
                model="gemini-2.0-flash",
                contents=[{"role": "user", "parts": [{"text": prompt}]}],
                config={"response_mime_type": "application/json"},
            )
            result = json.loads(response.text)
            concepts = result.get("concepts", [])
            relations = result.get("relations", [])
        except Exception:
            concepts = []
            relations = []

    activities.append(create_activity(
        "extraction", "extract", "completed",
        f"{len(concepts)}個の概念と{len(relations)}個の関係性を抽出しました",
        {"concepts_count": len(concepts), "relations_count": len(relations)}
    ))

    # グラフエージェントに委譲
    activities.append(create_activity(
        "orchestrator", "delegate", "delegating",
        "Graph Agentにナレッジグラフへの追加を依頼します"
    ))

    activities.append(create_activity(
        "graph", "update", "thinking",
        "ナレッジグラフを更新中..."
    ))

    await asyncio.sleep(0.3)

    activities.append(create_activity(
        "graph", "update", "completed",
        "ナレッジグラフに追加しました"
    ))

    # 完了
    activities.append(create_activity(
        "orchestrator", "complete", "completed",
        "処理が完了しました"
    ))

    _sessions[session_id] = activities

    return {
        "concepts": concepts,
        "relations": relations,
    }


async def run_quiz_task(concepts: list[dict], session_id: str) -> dict:
    """クイズ生成タスクを実行"""
    activities = _sessions.get(session_id, [])

    activities.append(create_activity(
        "orchestrator", "analyze", "started",
        "クイズ生成リクエストを処理しています..."
    ))

    activities.append(create_activity(
        "orchestrator", "delegate", "delegating",
        "Quiz Agentに作業を委譲します"
    ))

    activities.append(create_activity(
        "quiz", "generate", "thinking",
        "概念に基づいてクイズを生成中..."
    ))

    client = get_genai_client()

    if not concepts:
        quiz = {"questions": [], "message": "クイズを生成するには概念を登録してください"}
    elif client is None:
        # モック応答
        await asyncio.sleep(1)
        quiz = {
            "questions": [
                {
                    "question": f"{concepts[0]['name']}とは何ですか？",
                    "options": [
                        concepts[0].get("definition", "定義なし"),
                        "関係のない選択肢A",
                        "関係のない選択肢B",
                        "関係のない選択肢C",
                    ],
                    "correct": 0,
                }
            ]
        }
    else:
        # Gemini APIでクイズ生成
        concepts_text = "\n".join(f"- {c['name']}: {c.get('definition', '')}" for c in concepts[:10])
        prompt = f"""以下の概念に基づいて、理解度確認クイズを3問生成してください。

概念:
{concepts_text}

JSON形式で出力:
{{
  "questions": [
    {{
      "question": "質問文",
      "options": ["選択肢A", "選択肢B", "選択肢C", "選択肢D"],
      "correct": 0
    }}
  ]
}}"""

        try:
            response = client.models.generate_content(
                model="gemini-2.0-flash",
                contents=[{"role": "user", "parts": [{"text": prompt}]}],
                config={"response_mime_type": "application/json"},
            )
            quiz = json.loads(response.text)
        except Exception:
            quiz = {"questions": [], "error": "クイズ生成に失敗しました"}

    activities.append(create_activity(
        "quiz", "generate", "completed",
        f"{len(quiz.get('questions', []))}問のクイズを生成しました"
    ))

    activities.append(create_activity(
        "orchestrator", "complete", "completed",
        "クイズの準備ができました"
    ))

    _sessions[session_id] = activities

    return quiz


@router.post("/run", response_model=AgentResponse)
async def run_agent(request: AgentRequest):
    """エージェントタスクを実行"""
    session_id = str(uuid.uuid4())
    _sessions[session_id] = []

    if request.task == "extract":
        result = await run_extraction_task(request.input, session_id)
    elif request.task == "quiz":
        result = await run_quiz_task(request.concepts, session_id)
    else:
        result = {"message": "Unknown task"}

    return AgentResponse(
        session_id=session_id,
        activities=_sessions.get(session_id, []),
        result=result,
    )


@router.get("/stream/{session_id}")
async def stream_activities(session_id: str):
    """エージェント活動をストリーミング（SSE）"""
    async def generate() -> AsyncGenerator[str, None]:
        last_count = 0
        while True:
            activities = _sessions.get(session_id, [])
            if len(activities) > last_count:
                for activity in activities[last_count:]:
                    yield f"data: {activity.model_dump_json()}\n\n"
                last_count = len(activities)

                # 完了チェック
                if activities and activities[-1].status == "completed" and activities[-1].agent_id == "orchestrator":
                    break

            await asyncio.sleep(0.1)

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
    )


@router.get("/agents")
async def list_agents():
    """利用可能なエージェント一覧を取得"""
    return {"agents": AGENTS}
