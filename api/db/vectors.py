"""Vertex AI Vector Search ユーティリティ

概念のベクトル埋め込みと類似検索を提供
"""

import os
import numpy as np
from typing import Any


class VectorSearchClient:
    """ベクトル検索クライアント"""

    def __init__(self):
        self._client = None
        self._embeddings_cache: dict[str, list[float]] = {}

    def _get_client(self):
        """Gemini/Vertex AI クライアントを取得"""
        if self._client is None:
            from google import genai

            api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
            if api_key:
                self._client = genai.Client(api_key=api_key)
            else:
                project = os.getenv("GOOGLE_CLOUD_PROJECT")
                if project:
                    self._client = genai.Client(
                        vertexai=True, project=project, location="us-central1"
                    )
        return self._client

    def generate_embedding(self, text: str) -> list[float] | None:
        """テキストの埋め込みベクトルを生成

        Args:
            text: 埋め込みを生成するテキスト

        Returns:
            埋め込みベクトル（768次元）
        """
        # キャッシュチェック
        if text in self._embeddings_cache:
            return self._embeddings_cache[text]

        client = self._get_client()
        if client is None:
            return None

        try:
            # Gemini の embedding モデルを使用
            response = client.models.embed_content(
                model="text-embedding-004",
                contents=text,
            )

            if response.embeddings and len(response.embeddings) > 0:
                embedding = list(response.embeddings[0].values)
                self._embeddings_cache[text] = embedding
                return embedding

        except Exception as e:
            print(f"Embedding generation failed: {e}")
            return None

        return None

    def generate_concept_embedding(self, concept: dict[str, Any]) -> list[float] | None:
        """概念の埋め込みベクトルを生成

        概念名と定義を組み合わせてベクトル化

        Args:
            concept: 概念オブジェクト（name, definition を含む）

        Returns:
            埋め込みベクトル
        """
        # 日本語と英語の両方を含めて意味を豊かに
        name = concept.get("name_ja") or concept.get("name", "")
        name_en = concept.get("name_en", "")
        definition = concept.get("definition_ja") or concept.get("definition", "")
        concept_type = concept.get("concept_type", "concept")

        # 埋め込み用テキストを構築
        text_parts = [f"概念: {name}"]
        if name_en and name_en != name:
            text_parts.append(f"({name_en})")
        text_parts.append(f"\n種類: {concept_type}")
        text_parts.append(f"\n定義: {definition}")

        text = " ".join(text_parts)
        return self.generate_embedding(text)

    def cosine_similarity(self, vec1: list[float], vec2: list[float]) -> float:
        """コサイン類似度を計算

        Args:
            vec1: ベクトル1
            vec2: ベクトル2

        Returns:
            コサイン類似度（-1.0 ~ 1.0）
        """
        a = np.array(vec1)
        b = np.array(vec2)
        return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))

    def find_similar_concepts(
        self,
        query_embedding: list[float],
        concepts_with_embeddings: list[tuple[dict[str, Any], list[float]]],
        top_k: int = 5,
        threshold: float = 0.5,
    ) -> list[tuple[dict[str, Any], float]]:
        """類似概念を検索

        Args:
            query_embedding: クエリの埋め込みベクトル
            concepts_with_embeddings: (概念, 埋め込み) のリスト
            top_k: 返す結果の最大数
            threshold: 類似度の閾値

        Returns:
            (概念, 類似度スコア) のリスト（類似度降順）
        """
        results = []

        for concept, embedding in concepts_with_embeddings:
            if embedding is None:
                continue

            similarity = self.cosine_similarity(query_embedding, embedding)
            if similarity >= threshold:
                results.append((concept, similarity))

        # 類似度でソート
        results.sort(key=lambda x: x[1], reverse=True)

        return results[:top_k]

    def find_related_by_text(
        self,
        query_text: str,
        concepts_with_embeddings: list[tuple[dict[str, Any], list[float]]],
        top_k: int = 5,
        threshold: float = 0.5,
    ) -> list[tuple[dict[str, Any], float]]:
        """テキストクエリで関連概念を検索

        Args:
            query_text: 検索クエリテキスト
            concepts_with_embeddings: (概念, 埋め込み) のリスト
            top_k: 返す結果の最大数
            threshold: 類似度の閾値

        Returns:
            (概念, 類似度スコア) のリスト
        """
        query_embedding = self.generate_embedding(query_text)
        if query_embedding is None:
            return []

        return self.find_similar_concepts(
            query_embedding, concepts_with_embeddings, top_k, threshold
        )

    def suggest_implicit_relations(
        self,
        concepts: list[dict[str, Any]],
        existing_relations: list[dict[str, Any]],
        similarity_threshold: float = 0.7,
    ) -> list[dict[str, Any]]:
        """暗黙的な関係性を提案

        明示的にリンクされていないが、意味的に関連する概念ペアを発見

        Args:
            concepts: 概念リスト
            existing_relations: 既存の関係性リスト
            similarity_threshold: 提案の閾値

        Returns:
            提案される関係性のリスト
        """
        # 埋め込みを生成
        concept_embeddings = []
        for concept in concepts:
            embedding = self.generate_concept_embedding(concept)
            concept_embeddings.append((concept, embedding))

        # 既存の関係性をセットに変換
        existing_pairs = set()
        for rel in existing_relations:
            existing_pairs.add((rel["source"], rel["target"]))
            existing_pairs.add((rel["target"], rel["source"]))  # 双方向

        # 類似ペアを発見
        suggested_relations = []
        for i, (concept1, emb1) in enumerate(concept_embeddings):
            if emb1 is None:
                continue

            for j, (concept2, emb2) in enumerate(concept_embeddings):
                if i >= j or emb2 is None:
                    continue

                # 既にリンクがある場合はスキップ
                name1 = concept1.get("name", "")
                name2 = concept2.get("name", "")
                if (name1, name2) in existing_pairs:
                    continue

                similarity = self.cosine_similarity(emb1, emb2)
                if similarity >= similarity_threshold:
                    suggested_relations.append({
                        "source": name1,
                        "source_id": concept1.get("id"),
                        "target": name2,
                        "target_id": concept2.get("id"),
                        "relation_type": "semantically-related",
                        "confidence": similarity,
                        "suggested": True,
                    })

        # 信頼度でソート
        suggested_relations.sort(key=lambda x: x["confidence"], reverse=True)

        return suggested_relations


# シングルトンインスタンス
_vector_client: VectorSearchClient | None = None


def get_vector_client() -> VectorSearchClient:
    """ベクトル検索クライアントのシングルトンを取得"""
    global _vector_client
    if _vector_client is None:
        _vector_client = VectorSearchClient()
    return _vector_client
