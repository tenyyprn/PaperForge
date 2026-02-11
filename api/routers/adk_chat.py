"""ADK Runner を使用したチャットAPI

Google ADK の Runner を正式に使用してエージェントを実行
"""

import os
import uuid
from datetime import datetime
from typing import AsyncGenerator

from fastapi import APIRouter, Header
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

router = APIRouter()


class ChatMessage(BaseModel):
    role: str
    content: str


class Concept(BaseModel):
    name: str
    name_ja: str = ""
    definition: str
    definition_ja: str = ""
    concept_type: str = "concept"


class ADKChatRequest(BaseModel):
    message: str
    session_id: str | None = None
    concepts: list[Concept] = []


class AgentEvent(BaseModel):
    event_type: str  # "thinking", "tool_call", "tool_result", "response", "error"
    agent_name: str
    content: str
    timestamp: str
    metadata: dict = {}


class ADKChatResponse(BaseModel):
    session_id: str
    response: str
    events: list[AgentEvent]


# グローバルなセッションサービス（シングルトン）
_session_service = None


def _get_session_service():
    """ADK セッションサービスを取得（シングルトン）"""
    global _session_service
    if _session_service is None:
        from google.adk.sessions import InMemorySessionService
        _session_service = InMemorySessionService()
    return _session_service


# グローバルな Runner（シングルトン）
_runner = None


def _get_runner():
    """ADK Runner を取得（シングルトン）"""
    global _runner
    if _runner is None:
        from google.adk import Runner
        from agents.tutor.agent import tutor_agent

        _runner = Runner(
            agent=tutor_agent,
            app_name="paperforge",
            session_service=_get_session_service(),
        )
    return _runner


def _build_context_message(concepts: list[Concept]) -> str:
    """概念リストからコンテキストメッセージを構築"""
    if not concepts:
        return ""

    context_parts = ["[ユーザーのナレッジグラフに登録されている概念]"]
    for c in concepts[:20]:  # 最大20件
        name = c.name_ja or c.name
        definition = c.definition_ja or c.definition
        context_parts.append(f"- {name} [{c.concept_type}]: {definition}")

    return "\n".join(context_parts)


@router.post("/", response_model=ADKChatResponse)
async def adk_chat(
    request: ADKChatRequest,
    x_user_id: str | None = Header(default=None),
):
    """ADK Runner を使用してエージェントとチャット

    これは Google ADK の正式な使用方法です：
    1. Runner でエージェントを実行
    2. Session でコンテキストを管理
    3. Agent が自律的にツールを選択・実行
    """
    from google.genai import types

    events: list[AgentEvent] = []
    user_id = x_user_id or "anonymous"

    # セッションIDの決定
    session_id = request.session_id or f"session_{uuid.uuid4().hex[:8]}"

    # セッションサービスとランナーを取得
    session_service = _get_session_service()
    runner = _get_runner()

    # セッションを取得または作成
    session = session_service.get_session(
        app_name="paperforge",
        user_id=user_id,
        session_id=session_id,
    )
    if session is None:
        session = session_service.create_session(
            app_name="paperforge",
            user_id=user_id,
            session_id=session_id,
        )

    # コンテキスト付きメッセージを構築
    context = _build_context_message(request.concepts)
    full_message = request.message
    if context:
        full_message = f"{context}\n\n[ユーザーの質問]\n{request.message}"

    events.append(AgentEvent(
        event_type="thinking",
        agent_name="Tutor Agent",
        content="リクエストを処理しています...",
        timestamp=datetime.now().isoformat(),
    ))

    # メッセージを構築
    content = types.Content(
        role="user",
        parts=[types.Part(text=full_message)],
    )

    response_text = ""

    try:
        # ADK Runner でエージェントを実行
        async for event in runner.run_async(
            user_id=user_id,
            session_id=session_id,
            new_message=content,
        ):
            # イベントを処理
            if hasattr(event, "content") and event.content:
                for part in event.content.parts:
                    # テキスト応答
                    if hasattr(part, "text") and part.text:
                        response_text = part.text
                        events.append(AgentEvent(
                            event_type="response",
                            agent_name="Tutor Agent",
                            content=part.text[:100] + "..." if len(part.text) > 100 else part.text,
                            timestamp=datetime.now().isoformat(),
                        ))

                    # ツール呼び出し
                    if hasattr(part, "function_call") and part.function_call:
                        fc = part.function_call
                        events.append(AgentEvent(
                            event_type="tool_call",
                            agent_name="Tutor Agent",
                            content=f"ツール呼び出し: {fc.name}",
                            timestamp=datetime.now().isoformat(),
                            metadata={
                                "tool_name": fc.name,
                                "args": dict(fc.args) if fc.args else {},
                            },
                        ))

                    # ツール結果
                    if hasattr(part, "function_response") and part.function_response:
                        fr = part.function_response
                        events.append(AgentEvent(
                            event_type="tool_result",
                            agent_name="Tutor Agent",
                            content=f"ツール結果: {fr.name}",
                            timestamp=datetime.now().isoformat(),
                        ))

    except Exception as e:
        events.append(AgentEvent(
            event_type="error",
            agent_name="Tutor Agent",
            content=str(e),
            timestamp=datetime.now().isoformat(),
        ))
        response_text = f"エラーが発生しました: {str(e)}"

    events.append(AgentEvent(
        event_type="completed",
        agent_name="Tutor Agent",
        content="処理完了",
        timestamp=datetime.now().isoformat(),
    ))

    return ADKChatResponse(
        session_id=session_id,
        response=response_text,
        events=events,
    )


@router.post("/stream")
async def adk_chat_stream(
    request: ADKChatRequest,
    x_user_id: str | None = Header(default=None),
):
    """ADK Runner を使用してストリーミングでチャット"""
    from google.genai import types
    import json

    user_id = x_user_id or "anonymous"
    session_id = request.session_id or f"session_{uuid.uuid4().hex[:8]}"

    session_service = _get_session_service()
    runner = _get_runner()

    session = session_service.get_session(
        app_name="paperforge",
        user_id=user_id,
        session_id=session_id,
    )
    if session is None:
        session = session_service.create_session(
            app_name="paperforge",
            user_id=user_id,
            session_id=session_id,
        )

    context = _build_context_message(request.concepts)
    full_message = request.message
    if context:
        full_message = f"{context}\n\n[ユーザーの質問]\n{request.message}"

    content = types.Content(
        role="user",
        parts=[types.Part(text=full_message)],
    )

    async def generate() -> AsyncGenerator[str, None]:
        yield f"data: {json.dumps({'type': 'start', 'session_id': session_id})}\n\n"

        try:
            async for event in runner.run_async(
                user_id=user_id,
                session_id=session_id,
                new_message=content,
            ):
                if hasattr(event, "content") and event.content:
                    for part in event.content.parts:
                        if hasattr(part, "text") and part.text:
                            yield f"data: {json.dumps({'type': 'text', 'content': part.text})}\n\n"

                        if hasattr(part, "function_call") and part.function_call:
                            fc = part.function_call
                            yield f"data: {json.dumps({'type': 'tool_call', 'name': fc.name})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

        yield f"data: {json.dumps({'type': 'end'})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
    )


@router.get("/sessions/{session_id}")
async def get_session_history(
    session_id: str,
    x_user_id: str | None = Header(default=None),
):
    """セッションの会話履歴を取得"""
    user_id = x_user_id or "anonymous"
    session_service = _get_session_service()

    session = session_service.get_session(
        app_name="paperforge",
        user_id=user_id,
        session_id=session_id,
    )

    if session is None:
        return {"error": "セッションが見つかりません", "messages": []}

    # セッションからメッセージを取得
    messages = []
    if hasattr(session, "messages"):
        for msg in session.messages:
            if hasattr(msg, "content") and msg.content:
                for part in msg.content.parts:
                    if hasattr(part, "text") and part.text:
                        messages.append({
                            "role": msg.content.role,
                            "content": part.text,
                        })

    return {
        "session_id": session_id,
        "messages": messages,
    }
