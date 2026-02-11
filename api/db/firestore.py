"""Firestore クライアントユーティリティ"""

import os
from typing import Any
from google.cloud import firestore
from google.cloud.firestore_v1.base_document import DocumentSnapshot


class FirestoreClient:
    """Firestore操作をラップするクライアント"""

    def __init__(self, project_id: str | None = None):
        """
        Firestoreクライアントを初期化

        Args:
            project_id: Google Cloud Project ID（省略時は環境変数から取得）
        """
        self.project_id = project_id or os.getenv("GOOGLE_CLOUD_PROJECT")
        self._client: firestore.Client | None = None

    @property
    def client(self) -> firestore.Client:
        """Firestoreクライアントを取得（遅延初期化）"""
        if self._client is None:
            if self.project_id:
                self._client = firestore.Client(project=self.project_id)
            else:
                # ローカル開発用: エミュレータまたはデフォルト認証を使用
                self._client = firestore.Client()
        return self._client

    def collection(self, name: str) -> firestore.CollectionReference:
        """コレクション参照を取得"""
        return self.client.collection(name)

    # ========== 概念（Concepts）操作 ==========

    async def add_concept(self, user_id: str, concept: dict[str, Any]) -> str:
        """概念を追加"""
        doc_ref = self.collection("users").document(user_id).collection("concepts").document(concept["id"])
        doc_ref.set(concept)
        return concept["id"]

    async def add_concepts_batch(self, user_id: str, concepts: list[dict[str, Any]]) -> list[str]:
        """複数の概念を一括追加"""
        batch = self.client.batch()
        concept_ids = []

        for concept in concepts:
            doc_ref = self.collection("users").document(user_id).collection("concepts").document(concept["id"])
            batch.set(doc_ref, concept, merge=True)
            concept_ids.append(concept["id"])

        batch.commit()
        return concept_ids

    async def get_concept(self, user_id: str, concept_id: str) -> dict[str, Any] | None:
        """概念を取得"""
        doc_ref = self.collection("users").document(user_id).collection("concepts").document(concept_id)
        doc = doc_ref.get()
        if doc.exists:
            return doc.to_dict()
        return None

    async def get_all_concepts(self, user_id: str) -> list[dict[str, Any]]:
        """ユーザーの全概念を取得"""
        concepts_ref = self.collection("users").document(user_id).collection("concepts")
        docs = concepts_ref.stream()
        return [doc.to_dict() for doc in docs]

    async def delete_concept(self, user_id: str, concept_id: str) -> bool:
        """概念を削除"""
        doc_ref = self.collection("users").document(user_id).collection("concepts").document(concept_id)
        doc_ref.delete()
        return True

    async def clear_concepts(self, user_id: str) -> int:
        """ユーザーの全概念を削除"""
        concepts_ref = self.collection("users").document(user_id).collection("concepts")
        docs = concepts_ref.stream()
        count = 0
        for doc in docs:
            doc.reference.delete()
            count += 1
        return count

    # ========== 関係性（Relations）操作 ==========

    async def add_relation(self, user_id: str, relation: dict[str, Any]) -> str:
        """関係性を追加"""
        doc_ref = self.collection("users").document(user_id).collection("relations").document(relation["id"])
        doc_ref.set(relation)
        return relation["id"]

    async def add_relations_batch(self, user_id: str, relations: list[dict[str, Any]]) -> list[str]:
        """複数の関係性を一括追加"""
        batch = self.client.batch()
        relation_ids = []

        for relation in relations:
            doc_ref = self.collection("users").document(user_id).collection("relations").document(relation["id"])
            batch.set(doc_ref, relation, merge=True)
            relation_ids.append(relation["id"])

        batch.commit()
        return relation_ids

    async def get_all_relations(self, user_id: str) -> list[dict[str, Any]]:
        """ユーザーの全関係性を取得"""
        relations_ref = self.collection("users").document(user_id).collection("relations")
        docs = relations_ref.stream()
        return [doc.to_dict() for doc in docs]

    async def clear_relations(self, user_id: str) -> int:
        """ユーザーの全関係性を削除"""
        relations_ref = self.collection("users").document(user_id).collection("relations")
        docs = relations_ref.stream()
        count = 0
        for doc in docs:
            doc.reference.delete()
            count += 1
        return count

    # ========== 論文（Papers）操作 ==========

    async def add_paper(self, user_id: str, paper: dict[str, Any]) -> str:
        """論文を追加"""
        doc_ref = self.collection("users").document(user_id).collection("papers").document(paper["id"])
        doc_ref.set(paper)
        return paper["id"]

    async def get_all_papers(self, user_id: str) -> list[dict[str, Any]]:
        """ユーザーの全論文を取得"""
        papers_ref = self.collection("users").document(user_id).collection("papers")
        docs = papers_ref.stream()
        return [doc.to_dict() for doc in docs]

    async def delete_paper(self, user_id: str, paper_id: str) -> bool:
        """論文を削除"""
        doc_ref = self.collection("users").document(user_id).collection("papers").document(paper_id)
        doc_ref.delete()
        return True

    async def clear_papers(self, user_id: str) -> int:
        """ユーザーの全論文を削除"""
        papers_ref = self.collection("users").document(user_id).collection("papers")
        docs = papers_ref.stream()
        count = 0
        for doc in docs:
            doc.reference.delete()
            count += 1
        return count

    # ========== グラフ全体操作 ==========

    async def get_graph(self, user_id: str) -> dict[str, Any]:
        """ユーザーのナレッジグラフ全体を取得"""
        concepts = await self.get_all_concepts(user_id)
        relations = await self.get_all_relations(user_id)
        return {
            "concepts": concepts,
            "relations": relations,
        }

    async def sync_graph(
        self,
        user_id: str,
        concepts: list[dict[str, Any]],
        relations: list[dict[str, Any]],
    ) -> dict[str, int]:
        """フロントエンドからグラフを同期"""
        # 既存データを取得
        existing_concepts = {c["id"] for c in await self.get_all_concepts(user_id)}
        existing_relations = {r["id"] for r in await self.get_all_relations(user_id)}

        # 新規追加のみ（既存は上書き）
        new_concept_ids = [c["id"] for c in concepts]
        new_relation_ids = [r["id"] for r in relations]

        # バッチ追加
        await self.add_concepts_batch(user_id, concepts)
        await self.add_relations_batch(user_id, relations)

        return {
            "concepts_synced": len(concepts),
            "relations_synced": len(relations),
        }

    async def clear_graph(self, user_id: str) -> dict[str, int]:
        """ユーザーのナレッジグラフをクリア"""
        concepts_deleted = await self.clear_concepts(user_id)
        relations_deleted = await self.clear_relations(user_id)
        return {
            "concepts_deleted": concepts_deleted,
            "relations_deleted": relations_deleted,
        }


# シングルトンインスタンス
_firestore_client: FirestoreClient | None = None


def get_firestore_client() -> FirestoreClient:
    """Firestoreクライアントのシングルトンを取得"""
    global _firestore_client
    if _firestore_client is None:
        _firestore_client = FirestoreClient()
    return _firestore_client
