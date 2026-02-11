"""ナレッジグラフ関連のAPIエンドポイント - Firestore連携"""

import os
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel

router = APIRouter()

# Firestore クライアント（遅延初期化）
_db_client = None


def get_db():
    """Firestoreクライアントを取得"""
    global _db_client
    if _db_client is None:
        # Firestoreが利用可能かチェック
        project_id = os.getenv("GOOGLE_CLOUD_PROJECT")
        if project_id:
            from api.db.firestore import get_firestore_client
            _db_client = get_firestore_client()
    return _db_client


def get_user_id(x_user_id: str | None = None) -> str:
    """ユーザーIDを取得（認証未実装のため仮実装）"""
    # TODO: Firebase Auth等の認証を実装後、トークンからユーザーIDを取得
    return x_user_id or "anonymous"


class Concept(BaseModel):
    id: str
    name: str
    name_en: str = ""
    name_ja: str = ""
    definition: str
    definition_ja: str = ""
    concept_type: str = "concept"
    source_paper: str | None = None


class Relation(BaseModel):
    id: str
    source: str
    target: str
    relation_type: str


class GraphData(BaseModel):
    concepts: list[Concept]
    relations: list[Relation]


class SyncRequest(BaseModel):
    concepts: list[Concept]
    relations: list[Relation]


class SyncResponse(BaseModel):
    success: bool
    concepts_synced: int
    relations_synced: int
    storage: str  # "firestore" or "memory"


class ClearResponse(BaseModel):
    success: bool
    concepts_deleted: int
    relations_deleted: int


# インメモリストレージ（Firestore未設定時のフォールバック）
_memory_storage: dict[str, GraphData] = {}


def get_memory_storage(user_id: str) -> GraphData:
    """インメモリストレージからグラフを取得"""
    if user_id not in _memory_storage:
        _memory_storage[user_id] = GraphData(concepts=[], relations=[])
    return _memory_storage[user_id]


@router.get("/", response_model=GraphData)
async def get_graph(x_user_id: str | None = Header(default=None)):
    """ナレッジグラフ全体を取得する"""
    user_id = get_user_id(x_user_id)
    db = get_db()

    if db:
        # Firestore から取得
        data = await db.get_graph(user_id)
        return GraphData(
            concepts=[Concept(**c) for c in data["concepts"]],
            relations=[Relation(**r) for r in data["relations"]],
        )
    else:
        # インメモリストレージから取得
        return get_memory_storage(user_id)


@router.post("/sync", response_model=SyncResponse)
async def sync_graph(
    request: SyncRequest,
    x_user_id: str | None = Header(default=None),
):
    """フロントエンドからナレッジグラフを同期する"""
    user_id = get_user_id(x_user_id)
    db = get_db()

    if db:
        # Firestore に同期
        result = await db.sync_graph(
            user_id,
            [c.model_dump() for c in request.concepts],
            [r.model_dump() for r in request.relations],
        )
        return SyncResponse(
            success=True,
            concepts_synced=result["concepts_synced"],
            relations_synced=result["relations_synced"],
            storage="firestore",
        )
    else:
        # インメモリストレージに保存
        storage = get_memory_storage(user_id)

        # 既存IDを取得
        existing_concept_ids = {c.id for c in storage.concepts}
        existing_relation_ids = {r.id for r in storage.relations}

        # 新規のみ追加（既存は更新）
        for concept in request.concepts:
            if concept.id in existing_concept_ids:
                # 更新
                storage.concepts = [c if c.id != concept.id else concept for c in storage.concepts]
            else:
                storage.concepts.append(concept)

        for relation in request.relations:
            if relation.id in existing_relation_ids:
                storage.relations = [r if r.id != relation.id else relation for r in storage.relations]
            else:
                storage.relations.append(relation)

        return SyncResponse(
            success=True,
            concepts_synced=len(request.concepts),
            relations_synced=len(request.relations),
            storage="memory",
        )


@router.delete("/", response_model=ClearResponse)
async def clear_graph(x_user_id: str | None = Header(default=None)):
    """ナレッジグラフをクリアする"""
    user_id = get_user_id(x_user_id)
    db = get_db()

    if db:
        result = await db.clear_graph(user_id)
        return ClearResponse(
            success=True,
            concepts_deleted=result["concepts_deleted"],
            relations_deleted=result["relations_deleted"],
        )
    else:
        storage = get_memory_storage(user_id)
        concepts_count = len(storage.concepts)
        relations_count = len(storage.relations)
        storage.concepts = []
        storage.relations = []
        return ClearResponse(
            success=True,
            concepts_deleted=concepts_count,
            relations_deleted=relations_count,
        )


@router.get("/concepts", response_model=list[Concept])
async def list_concepts(
    query: str | None = None,
    limit: int = 100,
    x_user_id: str | None = Header(default=None),
):
    """概念一覧を取得する"""
    user_id = get_user_id(x_user_id)
    db = get_db()

    if db:
        concepts = await db.get_all_concepts(user_id)
        result = [Concept(**c) for c in concepts]
    else:
        result = get_memory_storage(user_id).concepts

    # クエリでフィルタリング
    if query:
        query_lower = query.lower()
        result = [
            c for c in result
            if query_lower in c.name.lower()
            or query_lower in c.name_ja.lower()
            or query_lower in c.definition.lower()
        ]

    return result[:limit]


@router.get("/concepts/{concept_id}", response_model=Concept)
async def get_concept(
    concept_id: str,
    x_user_id: str | None = Header(default=None),
):
    """特定の概念を取得する"""
    user_id = get_user_id(x_user_id)
    db = get_db()

    if db:
        concept = await db.get_concept(user_id, concept_id)
        if concept:
            return Concept(**concept)
    else:
        storage = get_memory_storage(user_id)
        for c in storage.concepts:
            if c.id == concept_id:
                return c

    raise HTTPException(status_code=404, detail="概念が見つかりません")


@router.get("/concepts/{concept_id}/related", response_model=list[Concept])
async def get_related_concepts(
    concept_id: str,
    depth: int = 1,
    x_user_id: str | None = Header(default=None),
):
    """関連する概念を取得する"""
    user_id = get_user_id(x_user_id)
    db = get_db()

    if db:
        data = await db.get_graph(user_id)
        concepts = {c["id"]: Concept(**c) for c in data["concepts"]}
        relations = data["relations"]
    else:
        storage = get_memory_storage(user_id)
        concepts = {c.id: c for c in storage.concepts}
        relations = [r.model_dump() for r in storage.relations]

    if concept_id not in concepts:
        raise HTTPException(status_code=404, detail="概念が見つかりません")

    # 関連概念を探索
    related_ids: set[str] = set()
    current_ids = {concept_id}

    for _ in range(depth):
        next_ids: set[str] = set()
        for rel in relations:
            if rel["source"] in current_ids and rel["target"] in concepts:
                next_ids.add(rel["target"])
            if rel["target"] in current_ids and rel["source"] in concepts:
                next_ids.add(rel["source"])
        related_ids.update(next_ids)
        current_ids = next_ids

    # 元の概念を除外
    related_ids.discard(concept_id)

    return [concepts[cid] for cid in related_ids if cid in concepts]


@router.get("/stats")
async def get_stats(x_user_id: str | None = Header(default=None)):
    """ナレッジグラフの統計情報を取得"""
    user_id = get_user_id(x_user_id)
    db = get_db()

    if db:
        data = await db.get_graph(user_id)
        concepts = data["concepts"]
        relations = data["relations"]
    else:
        storage = get_memory_storage(user_id)
        concepts = [c.model_dump() for c in storage.concepts]
        relations = [r.model_dump() for r in storage.relations]

    # タイプ別集計
    type_counts: dict[str, int] = {}
    for c in concepts:
        ctype = c.get("concept_type", "concept")
        type_counts[ctype] = type_counts.get(ctype, 0) + 1

    # 関係タイプ別集計
    relation_type_counts: dict[str, int] = {}
    for r in relations:
        rtype = r.get("relation_type", "related")
        relation_type_counts[rtype] = relation_type_counts.get(rtype, 0) + 1

    return {
        "total_concepts": len(concepts),
        "total_relations": len(relations),
        "concept_types": type_counts,
        "relation_types": relation_type_counts,
        "storage": "firestore" if db else "memory",
    }


# ========== セマンティック検索 API ==========

class SemanticSearchRequest(BaseModel):
    query: str
    top_k: int = 5
    threshold: float = 0.5


class SuggestRelationsRequest(BaseModel):
    threshold: float = 0.7


class SimilarConceptResult(BaseModel):
    concept: Concept
    similarity: float


@router.post("/semantic-search", response_model=list[SimilarConceptResult])
async def semantic_search(
    request: SemanticSearchRequest,
    x_user_id: str | None = Header(default=None),
):
    """テキストクエリで概念をセマンティック検索

    Vertex AI Embeddings を使用して意味的に類似した概念を検索
    """
    from api.db.vectors import get_vector_client

    user_id = get_user_id(x_user_id)
    db = get_db()
    vector_client = get_vector_client()

    # 概念を取得
    if db:
        data = await db.get_graph(user_id)
        concepts = data["concepts"]
    else:
        storage = get_memory_storage(user_id)
        concepts = [c.model_dump() for c in storage.concepts]

    if not concepts:
        return []

    # 概念の埋め込みを生成
    concepts_with_embeddings = []
    for concept in concepts:
        embedding = vector_client.generate_concept_embedding(concept)
        concepts_with_embeddings.append((concept, embedding))

    # 類似検索
    results = vector_client.find_related_by_text(
        request.query,
        concepts_with_embeddings,
        top_k=request.top_k,
        threshold=request.threshold,
    )

    return [
        SimilarConceptResult(
            concept=Concept(**concept),
            similarity=round(similarity, 3),
        )
        for concept, similarity in results
    ]


@router.post("/suggest-relations")
async def suggest_relations(
    request: SuggestRelationsRequest,
    x_user_id: str | None = Header(default=None),
):
    """意味的類似性に基づいて暗黙的な関係性を提案

    明示的にリンクされていないが、意味的に関連する概念ペアを発見
    """
    from api.db.vectors import get_vector_client

    user_id = get_user_id(x_user_id)
    db = get_db()
    vector_client = get_vector_client()

    # グラフデータを取得
    if db:
        data = await db.get_graph(user_id)
        concepts = data["concepts"]
        relations = data["relations"]
    else:
        storage = get_memory_storage(user_id)
        concepts = [c.model_dump() for c in storage.concepts]
        relations = [r.model_dump() for r in storage.relations]

    if len(concepts) < 2:
        return {"suggestions": [], "message": "関係性を提案するには2つ以上の概念が必要です"}

    # 暗黙的な関係性を発見
    suggestions = vector_client.suggest_implicit_relations(
        concepts,
        relations,
        similarity_threshold=request.threshold,
    )

    return {
        "suggestions": suggestions,
        "total_suggestions": len(suggestions),
    }


@router.get("/concepts/{concept_id}/similar", response_model=list[SimilarConceptResult])
async def get_similar_concepts(
    concept_id: str,
    top_k: int = 5,
    threshold: float = 0.5,
    x_user_id: str | None = Header(default=None),
):
    """特定の概念に意味的に類似した概念を取得"""
    from api.db.vectors import get_vector_client

    user_id = get_user_id(x_user_id)
    db = get_db()
    vector_client = get_vector_client()

    # 概念を取得
    if db:
        data = await db.get_graph(user_id)
        concepts = data["concepts"]
    else:
        storage = get_memory_storage(user_id)
        concepts = [c.model_dump() for c in storage.concepts]

    # 対象概念を検索
    target_concept = None
    other_concepts = []
    for c in concepts:
        if c["id"] == concept_id:
            target_concept = c
        else:
            other_concepts.append(c)

    if target_concept is None:
        raise HTTPException(status_code=404, detail="概念が見つかりません")

    # 対象概念の埋め込みを生成
    target_embedding = vector_client.generate_concept_embedding(target_concept)
    if target_embedding is None:
        return []

    # 他の概念の埋め込みを生成
    concepts_with_embeddings = []
    for concept in other_concepts:
        embedding = vector_client.generate_concept_embedding(concept)
        concepts_with_embeddings.append((concept, embedding))

    # 類似検索
    results = vector_client.find_similar_concepts(
        target_embedding,
        concepts_with_embeddings,
        top_k=top_k,
        threshold=threshold,
    )

    return [
        SimilarConceptResult(
            concept=Concept(**concept),
            similarity=round(similarity, 3),
        )
        for concept, similarity in results
    ]
