"""ナレッジグラフ関連のAPIエンドポイント"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()


class Concept(BaseModel):
    id: str
    name: str
    definition: str
    source_paper: str | None = None


class Relation(BaseModel):
    id: str
    source: str
    target: str
    relation_type: str


class GraphData(BaseModel):
    concepts: list[Concept]
    relations: list[Relation]


@router.get("/", response_model=GraphData)
async def get_graph():
    """ナレッジグラフ全体を取得する"""
    # TODO: Firestoreからグラフデータを取得
    return GraphData(concepts=[], relations=[])


@router.get("/concepts", response_model=list[Concept])
async def list_concepts(query: str | None = None, limit: int = 100):
    """概念一覧を取得する"""
    # TODO: 概念の検索・一覧取得を実装
    return []


@router.get("/concepts/{concept_id}", response_model=Concept)
async def get_concept(concept_id: str):
    """特定の概念を取得する"""
    # TODO: Firestoreから概念を取得
    raise HTTPException(status_code=404, detail="概念が見つかりません")


@router.get("/concepts/{concept_id}/related", response_model=list[Concept])
async def get_related_concepts(concept_id: str, depth: int = 1):
    """関連する概念を取得する"""
    # TODO: 関連概念の取得を実装
    return []
