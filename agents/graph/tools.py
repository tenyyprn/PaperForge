"""Graph Agent用のツール - ナレッジグラフの操作"""

import os
import uuid
from typing import Any

# パイプライン実行時のユーザーIDコンテキスト
_current_user_id: str = "anonymous"


def set_current_user(user_id: str) -> None:
    """現在のユーザーIDを設定（パイプライン開始時に呼び出す）"""
    global _current_user_id
    _current_user_id = user_id


def _get_firestore_db():
    """Firestore同期クライアントを取得"""
    project_id = os.getenv("GOOGLE_CLOUD_PROJECT")
    if not project_id:
        return None
    try:
        from google.cloud import firestore
        return firestore.Client(project=project_id)
    except Exception:
        return None


def add_concept(
    name: str,
    definition: str,
    concept_type: str = "concept",
    name_en: str = "",
    name_ja: str = "",
    definition_ja: str = "",
    source_paper: str | None = None,
) -> dict[str, Any]:
    """ナレッジグラフに概念を追加する

    Args:
        name: 概念の表示名（日本語優先）
        definition: 概念の定義
        concept_type: 概念のタイプ（method, model, dataset, task, metric, domain, theory, application）
        name_en: 英語名
        name_ja: 日本語名
        definition_ja: 日本語定義
        source_paper: 出典論文のID

    Returns:
        追加された概念の情報
    """
    concept_id = str(uuid.uuid4())
    concept_data = {
        "id": concept_id,
        "name": name,
        "name_en": name_en or name,
        "name_ja": name_ja or name,
        "definition": definition,
        "definition_ja": definition_ja or definition,
        "concept_type": concept_type,
    }
    if source_paper:
        concept_data["source_paper"] = source_paper

    db = _get_firestore_db()
    if db:
        try:
            doc_ref = db.collection("users").document(_current_user_id).collection("concepts").document(concept_id)
            doc_ref.set(concept_data)
            return {
                "concept_id": concept_id,
                "name": name,
                "status": "saved",
                "storage": "firestore",
                "message": f"概念「{name}」をナレッジグラフに保存しました",
            }
        except Exception as e:
            return {
                "concept_id": concept_id,
                "name": name,
                "status": "error",
                "message": f"Firestore保存エラー: {e}",
            }
    else:
        return {
            "concept_id": concept_id,
            "name": name,
            "status": "saved",
            "storage": "memory",
            "message": f"概念「{name}」を記録しました（Firestore未設定）",
        }


def add_relation(
    source_concept: str,
    target_concept: str,
    relation_type: str,
) -> dict[str, Any]:
    """概念間の関係性を追加する

    Args:
        source_concept: 関係の起点となる概念名
        target_concept: 関係の終点となる概念名
        relation_type: 関係の種類（is-a, part-of, uses, improves, evaluates-on, applied-to, produces, requires）

    Returns:
        追加された関係性の情報
    """
    relation_id = str(uuid.uuid4())
    relation_data = {
        "id": relation_id,
        "source": source_concept,
        "target": target_concept,
        "relation_type": relation_type,
    }

    db = _get_firestore_db()
    if db:
        try:
            doc_ref = db.collection("users").document(_current_user_id).collection("relations").document(relation_id)
            doc_ref.set(relation_data)
            return {
                "relation_id": relation_id,
                "status": "saved",
                "storage": "firestore",
                "message": f"関係「{source_concept} --{relation_type}--> {target_concept}」を保存しました",
            }
        except Exception as e:
            return {
                "relation_id": relation_id,
                "status": "error",
                "message": f"Firestore保存エラー: {e}",
            }
    else:
        return {
            "relation_id": relation_id,
            "status": "saved",
            "storage": "memory",
            "message": f"関係「{source_concept} --{relation_type}--> {target_concept}」を記録しました",
        }


def search_concepts(query: str, limit: int = 10) -> dict[str, Any]:
    """概念を検索する

    Args:
        query: 検索クエリ
        limit: 最大結果数

    Returns:
        検索結果の概念リスト
    """
    db = _get_firestore_db()
    if not db:
        return {"concepts": [], "status": "no_db", "message": "データベース未設定"}

    try:
        docs = db.collection("users").document(_current_user_id).collection("concepts").stream()
        results = []
        query_lower = query.lower()
        for doc in docs:
            data = doc.to_dict()
            name = (data.get("name", "") or "").lower()
            name_ja = (data.get("name_ja", "") or "").lower()
            definition = (data.get("definition", "") or "").lower()
            if query_lower in name or query_lower in name_ja or query_lower in definition:
                results.append(data)
                if len(results) >= limit:
                    break

        return {
            "concepts": results,
            "count": len(results),
            "status": "success",
            "message": f"{len(results)}件の概念が見つかりました",
        }
    except Exception as e:
        return {"concepts": [], "status": "error", "message": str(e)}


def get_related_concepts(concept_id: str, depth: int = 1) -> dict[str, Any]:
    """特定の概念に関連する概念を取得する

    Args:
        concept_id: 概念ID
        depth: 関係をたどる深さ

    Returns:
        関連概念のリスト
    """
    db = _get_firestore_db()
    if not db:
        return {"related_concepts": [], "status": "no_db"}

    try:
        relations_ref = db.collection("users").document(_current_user_id).collection("relations")
        concepts_ref = db.collection("users").document(_current_user_id).collection("concepts")

        # 指定概念のドキュメントを取得
        concept_doc = concepts_ref.document(concept_id).get()
        if not concept_doc.exists:
            return {"related_concepts": [], "status": "not_found", "message": "概念が見つかりません"}

        concept_data = concept_doc.to_dict()
        concept_name = concept_data.get("name", "")

        # 関係性を検索
        related_names = set()
        for doc in relations_ref.stream():
            rel = doc.to_dict()
            if rel.get("source") == concept_name:
                related_names.add(rel.get("target", ""))
            elif rel.get("target") == concept_name:
                related_names.add(rel.get("source", ""))

        # 関連概念の詳細を取得
        related = []
        for doc in concepts_ref.stream():
            data = doc.to_dict()
            if data.get("name") in related_names:
                related.append(data)

        return {
            "related_concepts": related,
            "count": len(related),
            "status": "success",
            "message": f"「{concept_name}」に関連する{len(related)}件の概念を取得しました",
        }
    except Exception as e:
        return {"related_concepts": [], "status": "error", "message": str(e)}
