"""Extraction Agent用のツール"""

from typing import Any


def extract_concepts(text: str) -> dict[str, Any]:
    """論文テキストから概念を抽出する

    Args:
        text: 論文のテキスト

    Returns:
        抽出された概念のリスト
    """
    # TODO: Gemma 2 + LoRAモデルを使用した抽出処理を実装
    return {
        "concepts": [],
        "status": "not_implemented",
    }


def extract_relations(text: str, concepts: list[str]) -> dict[str, Any]:
    """論文テキストから概念間の関係性を抽出する

    Args:
        text: 論文のテキスト
        concepts: 抽出済みの概念リスト

    Returns:
        抽出された関係性のリスト
    """
    # TODO: Gemma 2 + LoRAモデルを使用した抽出処理を実装
    return {
        "relations": [],
        "status": "not_implemented",
    }
