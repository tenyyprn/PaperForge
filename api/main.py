"""PaperForge API - Cloud Run用FastAPIアプリケーション"""

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routers import papers, chat, graph


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
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ルーターを登録
app.include_router(papers.router, prefix="/api/papers", tags=["papers"])
app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
app.include_router(graph.router, prefix="/api/graph", tags=["graph"])


@app.get("/health")
async def health_check():
    """ヘルスチェックエンドポイント"""
    return {"status": "healthy"}
