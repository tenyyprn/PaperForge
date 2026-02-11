"""PaperForge API - Cloud Run用FastAPIアプリケーション"""

import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv

# .envファイルを読み込み
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routers import papers, chat, graph, learning_path, agents, adk_chat


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 起動時の処理
    print("PaperForge API starting...")
    yield
    # 終了時の処理
    print("PaperForge API shutting down...")


app = FastAPI(
    title="PaperForge API",
    description="論文を知識資産に変えるパーソナルナレッジエージェント",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS設定
allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ルーターを登録
app.include_router(papers.router, prefix="/api/papers", tags=["papers"])
app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
app.include_router(graph.router, prefix="/api/graph", tags=["graph"])
app.include_router(learning_path.router, prefix="/api/learning-path", tags=["learning-path"])
app.include_router(agents.router, prefix="/api/agents", tags=["agents"])
app.include_router(adk_chat.router, prefix="/api/adk", tags=["adk"])


@app.get("/health")
async def health_check():
    """ヘルスチェックエンドポイント"""
    return {"status": "healthy"}
