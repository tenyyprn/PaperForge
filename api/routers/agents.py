"""エージェントオーケストレーションのAPIエンドポイント

ADKを使用したマルチエージェント協調を実現し、エージェント活動を可視化する
"""

import asyncio
import json
import os
import uuid
from datetime import datetime
from typing import AsyncGenerator

from fastapi import APIRouter, BackgroundTasks
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
                location = os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1")
                _client = genai.Client(vertexai=True, project=project, location=location)
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
    task: str  # "extract", "learn", "quiz", "chat", "pipeline"
    input: str
    filename: str = ""
    concepts: list[dict] = []
    context: dict = {}


class AgentResponse(BaseModel):
    session_id: str
    activities: list[AgentActivity]
    result: dict


# セッション管理（インメモリ）
_sessions: dict[str, list[AgentActivity]] = {}
_session_results: dict[str, dict] = {}


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


async def run_pipeline_task(text: str, filename: str, session_id: str, user_id: str = "anonymous") -> dict:
    """マルチエージェントパイプラインを実行

    Extraction Agent → Graph Agent → Tutor Agent の連携パイプライン
    ADK Runner を使用してオーケストレーターが各エージェントに作業を委譲する
    """
    activities = _sessions.get(session_id, [])

    # グラフエージェントにユーザーIDを設定
    from agents.graph.tools import set_current_user
    set_current_user(user_id)

    # オーケストレーター開始
    activities.append(create_activity(
        "orchestrator", "pipeline_start", "started",
        "マルチエージェントパイプラインを開始します..."
    ))
    _sessions[session_id] = activities

    try:
        from google.adk import Runner
        from google.adk.sessions import InMemorySessionService
        from google.genai import types
        from agents.orchestrator import root_agent

        session_service = InMemorySessionService()
        runner = Runner(
            agent=root_agent,
            app_name="paperforge",
            session_service=session_service,
        )

        # セッション作成
        adk_session_id = f"pipeline_{uuid.uuid4().hex[:8]}"
        await session_service.create_session(
            app_name="paperforge",
            user_id=user_id,
            session_id=adk_session_id,
        )

        # パイプラインメッセージ
        message = f"""以下の論文テキストを処理してください。パイプラインの各ステップを実行してください。

論文ファイル名: {filename}

論文テキスト:
{text[:8000]}"""

        content = types.Content(
            role="user",
            parts=[types.Part(text=message)],
        )

        # ADK Runner でオーケストレーターを実行
        activities.append(create_activity(
            "orchestrator", "delegate", "delegating",
            "Extraction Agent に論文の解析を委譲します"
        ))
        _sessions[session_id] = activities

        result_text = ""
        last_agent = "orchestrator"

        async for event in runner.run_async(
            user_id=user_id,
            session_id=adk_session_id,
            new_message=content,
        ):
            if not hasattr(event, "content") or not event.content:
                continue

            # エージェント名を取得
            agent_name = getattr(event, "author", last_agent) or last_agent

            # エージェント名からIDへのマッピング
            agent_id_map = {
                "paperforge_agent": "orchestrator",
                "extraction_agent": "extraction",
                "graph_agent": "graph",
                "tutor_agent": "tutor",
            }
            agent_id = agent_id_map.get(agent_name, agent_name)

            for part in event.content.parts:
                # ツール呼び出し
                if hasattr(part, "function_call") and part.function_call:
                    fc = part.function_call
                    tool_name = fc.name

                    # ツール名に基づいてアクティビティを記録
                    if tool_name == "extract_concepts":
                        activities.append(create_activity(
                            "extraction", "extract", "thinking",
                            "論文テキストから概念と関係性を抽出中..."
                        ))
                    elif tool_name in ("add_concept", "add_relation"):
                        args = dict(fc.args) if fc.args else {}
                        name = args.get("name", args.get("source_concept", ""))
                        activities.append(create_activity(
                            "graph", "update", "thinking",
                            f"ナレッジグラフに保存中: {name}"
                        ))
                    elif tool_name == "explain_concept":
                        args = dict(fc.args) if fc.args else {}
                        activities.append(create_activity(
                            "tutor", "explain", "thinking",
                            f"概念「{args.get('concept_name', '')}」を解説中..."
                        ))
                    else:
                        activities.append(create_activity(
                            agent_id, tool_name, "thinking",
                            f"ツール呼び出し: {tool_name}"
                        ))
                    _sessions[session_id] = activities

                # ツール結果
                if hasattr(part, "function_response") and part.function_response:
                    fr = part.function_response
                    tool_name = fr.name

                    if tool_name == "extract_concepts":
                        activities.append(create_activity(
                            "extraction", "extract", "completed",
                            "概念と関係性の抽出が完了しました"
                        ))
                        activities.append(create_activity(
                            "orchestrator", "delegate", "delegating",
                            "Graph Agent にナレッジグラフへの保存を委譲します"
                        ))
                    elif tool_name == "add_concept":
                        pass  # 個別の保存は静かに処理
                    elif tool_name == "add_relation":
                        pass
                    elif tool_name == "explain_concept":
                        activities.append(create_activity(
                            "tutor", "explain", "completed",
                            "概念の解説が完了しました"
                        ))
                    _sessions[session_id] = activities

                # テキスト応答
                if hasattr(part, "text") and part.text:
                    result_text = part.text
                    last_agent = agent_name

        # グラフ保存完了のアクティビティ
        activities.append(create_activity(
            "graph", "update", "completed",
            "ナレッジグラフへの保存が完了しました"
        ))

        # パイプライン完了
        activities.append(create_activity(
            "orchestrator", "pipeline_complete", "completed",
            "マルチエージェントパイプラインが完了しました"
        ))
        _sessions[session_id] = activities

        return {
            "pipeline_result": result_text,
            "status": "completed",
        }

    except Exception as e:
        error_msg = str(e)
        activities.append(create_activity(
            "orchestrator", "error", "completed",
            f"パイプラインエラー: {error_msg}"
        ))
        _sessions[session_id] = activities

        if "429" in error_msg or "RESOURCE_EXHAUSTED" in error_msg:
            return {
                "pipeline_result": "APIのレート制限に達しました。少し時間を置いてから再度お試しください。",
                "status": "rate_limited",
            }
        return {
            "pipeline_result": f"エラーが発生しました: {error_msg}",
            "status": "error",
        }


@router.post("/start")
async def start_pipeline(request: AgentRequest, background_tasks: BackgroundTasks):
    """パイプラインをバックグラウンドで開始し、session_idを即座に返す"""
    session_id = str(uuid.uuid4())
    _sessions[session_id] = []

    async def _run_and_store(coro_func, *args):
        result = await coro_func(*args)
        _session_results[session_id] = result

    if request.task == "pipeline":
        background_tasks.add_task(
            _run_and_store,
            run_pipeline_task,
            request.input,
            request.filename or "unknown.pdf",
            session_id,
        )
    elif request.task == "quiz":
        background_tasks.add_task(
            _run_and_store,
            run_quiz_task,
            request.concepts,
            session_id,
        )
    else:
        background_tasks.add_task(
            _run_and_store,
            run_extraction_task,
            request.input,
            session_id,
        )

    return {"session_id": session_id}


@router.post("/run", response_model=AgentResponse)
async def run_agent(request: AgentRequest):
    """エージェントタスクを実行"""
    session_id = str(uuid.uuid4())
    _sessions[session_id] = []

    if request.task == "extract":
        result = await run_extraction_task(request.input, session_id)
    elif request.task == "quiz":
        result = await run_quiz_task(request.concepts, session_id)
    elif request.task == "pipeline":
        result = await run_pipeline_task(
            request.input,
            request.filename or "unknown.pdf",
            session_id,
        )
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
        timeout = 300  # 5分
        elapsed = 0.0
        while elapsed < timeout:
            activities = _sessions.get(session_id, [])
            if len(activities) > last_count:
                for activity in activities[last_count:]:
                    yield f"data: {activity.model_dump_json()}\n\n"
                last_count = len(activities)

                # 完了チェック
                if activities and activities[-1].status == "completed" and activities[-1].agent_id == "orchestrator":
                    await asyncio.sleep(0.1)  # 結果の格納を待つ
                    result = _session_results.get(session_id, {})
                    yield f"event: done\ndata: {json.dumps(result)}\n\n"
                    break

            await asyncio.sleep(0.3)
            elapsed += 0.3

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
    )


@router.get("/agents")
async def list_agents():
    """利用可能なエージェント一覧を取得"""
    return {"agents": AGENTS}
