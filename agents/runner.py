"""ADK Agent Runner - エージェントを実行するためのユーティリティ"""

import os
from typing import AsyncGenerator
from dataclasses import dataclass, field
from datetime import datetime

from google.adk import Agent, Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types


@dataclass
class AgentEvent:
    """エージェントのイベント"""
    agent_name: str
    event_type: str  # "thinking", "tool_call", "response", "delegation"
    content: str
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())
    metadata: dict = field(default_factory=dict)


class AgentRunner:
    """ADKエージェントを実行するラッパー"""

    def __init__(self, agent: Agent):
        self.agent = agent
        self.session_service = InMemorySessionService()
        self.runner = Runner(
            agent=agent,
            app_name="paperforge",
            session_service=self.session_service,
        )
        self.events: list[AgentEvent] = []

    def _get_api_key(self) -> str | None:
        """API キーを取得"""
        return os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")

    async def run(
        self,
        user_message: str,
        session_id: str | None = None,
    ) -> AsyncGenerator[AgentEvent, None]:
        """エージェントを実行し、イベントをストリーミング"""

        # セッション作成
        if session_id is None:
            session_id = f"session_{datetime.now().timestamp()}"

        user_id = "default_user"

        # セッションが存在しない場合は作成
        session = self.session_service.get_session(
            app_name="paperforge",
            user_id=user_id,
            session_id=session_id,
        )
        if session is None:
            session = self.session_service.create_session(
                app_name="paperforge",
                user_id=user_id,
                session_id=session_id,
            )

        # 開始イベント
        yield AgentEvent(
            agent_name=self.agent.name,
            event_type="thinking",
            content="リクエストを処理しています...",
        )

        # エージェント実行
        content = types.Content(
            role="user",
            parts=[types.Part(text=user_message)],
        )

        response_text = ""

        async for event in self.runner.run_async(
            user_id=user_id,
            session_id=session_id,
            new_message=content,
        ):
            # イベントタイプに応じて処理
            if hasattr(event, "content") and event.content:
                for part in event.content.parts:
                    if hasattr(part, "text") and part.text:
                        response_text = part.text
                        yield AgentEvent(
                            agent_name=self.agent.name,
                            event_type="response",
                            content=part.text,
                        )
                    elif hasattr(part, "function_call") and part.function_call:
                        yield AgentEvent(
                            agent_name=self.agent.name,
                            event_type="tool_call",
                            content=f"ツール呼び出し: {part.function_call.name}",
                            metadata={
                                "tool_name": part.function_call.name,
                                "args": dict(part.function_call.args) if part.function_call.args else {},
                            },
                        )

        # 完了イベント
        yield AgentEvent(
            agent_name=self.agent.name,
            event_type="completed",
            content=response_text or "処理が完了しました",
        )


def create_runner(agent: Agent) -> AgentRunner:
    """エージェントランナーを作成"""
    return AgentRunner(agent)
