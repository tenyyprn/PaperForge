"""Extraction Agent用のツール - 論文から概念と関係性を抽出"""

import os
import json
import time
from typing import Any


def _get_genai_client():
    """Geminiクライアントを取得"""
    from google import genai
    api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
    if api_key:
        return genai.Client(api_key=api_key)
    project = os.getenv("GOOGLE_CLOUD_PROJECT")
    if project:
        location = os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1")
        return genai.Client(vertexai=True, project=project, location=location)
    return None


def _call_with_retry(client, **kwargs) -> str:
    """リトライ付きで Gemini API を呼び出す"""
    for attempt in range(3):
        try:
            response = client.models.generate_content(**kwargs)
            return response.text
        except Exception as e:
            if ("429" in str(e) or "RESOURCE_EXHAUSTED" in str(e)) and attempt < 2:
                time.sleep(2 ** attempt)
                continue
            raise


EXTRACTION_PROMPT = """以下の論文テキストから、オントロジー（知識体系）を構築するための情報を抽出してください。
**重要：英語論文の場合、必ず日本語に翻訳してください。**

## 抽出してほしい情報：
1. 論文のメタ情報（タイトル、著者、発表年）- 英語と日本語の両方
2. 要約と主張 - 日本語で
3. 起承転結の構造 - 日本語で
4. 高校生向けのやさしい説明 - 日本語で
5. **オントロジー情報**：概念をタイプ分類し、意味的な関係を抽出 - 英語名と日本語名の両方

## 概念のタイプ（concept_type）：
- **method**: 手法・アルゴリズム
- **model**: モデル・システム
- **dataset**: データセット
- **task**: タスク・問題
- **metric**: 評価指標
- **domain**: 研究分野
- **theory**: 理論・概念
- **application**: 応用先

## 関係の種類（relation_type）：
- **is-a**: 上位概念-下位概念
- **part-of**: 全体-部分関係
- **uses**: 使用関係
- **improves**: 改良関係
- **evaluates-on**: 評価関係
- **applied-to**: 適用関係
- **produces**: 生成関係
- **requires**: 前提関係

## 出力は必ず以下のJSON形式で返してください：
```json
{{
  "summary": {{
    "title": "表示用タイトル（日本語優先）",
    "title_en": "Original English Title",
    "title_ja": "日本語タイトル（翻訳）",
    "authors": ["著者1", "著者2"],
    "year": "発表年",
    "original_language": "en または ja",
    "abstract": "論文の要約（日本語、2-3文）",
    "abstract_ja": "論文の要約（日本語、2-3文）",
    "main_claim": "この論文が主張したいこと（日本語、1文）",
    "main_claim_ja": "この論文が主張したいこと（日本語、1文）",
    "introduction": "【起】研究の背景と問題提起（日本語）",
    "development": "【承】提案手法や実験の説明（日本語）",
    "turn": "【転】重要な発見や意外な結果（日本語）",
    "conclusion": "【結】結論と今後の展望（日本語）",
    "easy_explanation": "高校生にもわかるように説明（日本語、3-5文）"
  }},
  "concepts": [
    {{
      "name": "表示用名前",
      "name_en": "English Name",
      "name_ja": "日本語名",
      "definition": "概念の定義（日本語）",
      "definition_ja": "概念の定義（日本語）",
      "concept_type": "method/model/dataset/task/metric/domain/theory/application"
    }}
  ],
  "relations": [
    {{"source": "概念名1", "target": "概念名2", "relation_type": "is-a/part-of/uses/improves/evaluates-on/applied-to/produces/requires"}}
  ]
}}
```

論文テキスト:
---
{text}
---

JSON形式で出力してください："""


def extract_concepts(text: str) -> dict[str, Any]:
    """論文テキストから概念、関係性、要約を抽出する

    Args:
        text: 論文のテキスト（最大10000文字が使用される）

    Returns:
        抽出された概念、関係性、要約を含む辞書
    """
    client = _get_genai_client()

    if client is None:
        return {
            "concepts": [
                {"name": "サンプル概念", "name_en": "Sample Concept", "name_ja": "サンプル概念",
                 "definition": "APIキー未設定のためサンプルデータです", "definition_ja": "APIキー未設定のためサンプルデータです",
                 "concept_type": "concept"}
            ],
            "relations": [],
            "summary": {
                "title": "サンプル論文",
                "title_en": "Sample Paper",
                "title_ja": "サンプル論文",
                "authors": [],
                "year": "",
                "abstract": "APIキーが設定されていないためサンプルデータです",
            },
            "status": "mock",
        }

    try:
        prompt = EXTRACTION_PROMPT.format(text=text[:10000])
        response_text = _call_with_retry(
            client,
            model="gemini-2.0-flash",
            contents=prompt,
        )

        if not response_text:
            return {"concepts": [], "relations": [], "summary": {}, "status": "empty_response"}

        # ```json と ``` を除去
        clean_text = response_text
        if "```json" in clean_text:
            clean_text = clean_text.split("```json")[1].split("```")[0]
        elif "```" in clean_text:
            parts = clean_text.split("```")
            for part in parts:
                if "{" in part and "concepts" in part:
                    clean_text = part
                    break

        clean_text = clean_text.strip()
        result = json.loads(clean_text)

        concepts_count = len(result.get("concepts", []))
        relations_count = len(result.get("relations", []))

        return {
            "concepts": result.get("concepts", []),
            "relations": result.get("relations", []),
            "summary": result.get("summary", {}),
            "status": "success",
            "message": f"{concepts_count}個の概念と{relations_count}個の関係性を抽出しました",
        }

    except json.JSONDecodeError as e:
        return {
            "concepts": [],
            "relations": [],
            "summary": {},
            "status": "parse_error",
            "message": f"JSON解析エラー: {e}",
        }
    except Exception as e:
        return {
            "concepts": [],
            "relations": [],
            "summary": {},
            "status": "error",
            "message": f"抽出エラー: {type(e).__name__}: {e}",
        }


def extract_relations(text: str, concepts: list[str]) -> dict[str, Any]:
    """論文テキストから概念間の関係性を追加抽出する

    Args:
        text: 論文のテキスト
        concepts: 抽出済みの概念名リスト

    Returns:
        抽出された関係性のリスト
    """
    client = _get_genai_client()

    if client is None:
        return {"relations": [], "status": "mock"}

    if not concepts:
        return {"relations": [], "status": "no_concepts"}

    try:
        concepts_text = ", ".join(concepts[:20])
        prompt = f"""以下の論文テキストと既に抽出された概念リストから、概念間の関係性を抽出してください。

概念リスト: {concepts_text}

関係の種類: is-a, part-of, uses, improves, evaluates-on, applied-to, produces, requires

JSON形式で出力:
{{
  "relations": [
    {{"source": "概念名1", "target": "概念名2", "relation_type": "関係タイプ"}}
  ]
}}

論文テキスト:
{text[:5000]}"""

        response_text = _call_with_retry(
            client,
            model="gemini-2.0-flash",
            contents=prompt,
        )

        if not response_text:
            return {"relations": [], "status": "empty_response"}

        clean_text = response_text
        if "```json" in clean_text:
            clean_text = clean_text.split("```json")[1].split("```")[0]
        elif "```" in clean_text:
            parts = clean_text.split("```")
            for part in parts:
                if "{" in part and "relations" in part:
                    clean_text = part
                    break

        result = json.loads(clean_text.strip())
        return {
            "relations": result.get("relations", []),
            "status": "success",
        }

    except Exception as e:
        return {
            "relations": [],
            "status": "error",
            "message": str(e),
        }
