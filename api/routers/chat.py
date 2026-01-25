"""チャット関連のAPIエンドポイント"""

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]


class ChatResponse(BaseModel):
    message: ChatMessage


@router.post("/", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """エージェントとチャットする"""
    # TODO: root_agentを呼び出してチャット処理

    return ChatResponse(
        message=ChatMessage(
            role="assistant",
            content="申し訳ありません。まだ実装されていません。",
        )
    )
