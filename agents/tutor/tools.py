"""Tutor Agent用のツール - 学習支援機能"""

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


def explain_concept(
    concept_name: str,
    concept_definition: str,
    detail_level: str = "intermediate",
) -> dict[str, Any]:
    """概念をわかりやすく説明する

    Args:
        concept_name: 説明する概念の名前
        concept_definition: 概念の定義
        detail_level: 説明の詳細度（beginner, intermediate, advanced）

    Returns:
        概念の説明
    """
    client = _get_genai_client()

    if client is None:
        return {
            "explanation": f"{concept_name}の説明（APIキー未設定のためモック応答）: {concept_definition}",
            "examples": [],
            "related_concepts": [],
        }

    level_prompts = {
        "beginner": "高校生でもわかるように、具体例を多く使って",
        "intermediate": "大学生向けに、適切な専門用語を使いつつ",
        "advanced": "専門家向けに、詳細かつ正確に",
    }

    prompt = f"""{level_prompts.get(detail_level, level_prompts["intermediate"])}以下の概念を説明してください。

概念名: {concept_name}
定義: {concept_definition}

JSON形式で出力:
{{
  "explanation": "わかりやすい説明",
  "examples": ["具体例1", "具体例2"],
  "related_concepts": ["関連概念1", "関連概念2"],
  "analogy": "日常生活に例えると..."
}}"""

    try:
        text = _call_with_retry(
            client,
            model="gemini-2.0-flash",
            contents=[{"role": "user", "parts": [{"text": prompt}]}],
            config={"response_mime_type": "application/json"},
        )
        return json.loads(text)
    except Exception as e:
        return {
            "explanation": concept_definition,
            "error": str(e),
        }


def generate_quiz(
    concepts: str,
    num_questions: int = 3,
    difficulty: str = "intermediate",
) -> dict[str, Any]:
    """理解度確認用のクイズを生成する

    Args:
        concepts: クイズ対象の概念リストのJSON文字列。例: [{"name": "概念名", "definition": "定義"}]
        num_questions: 問題数
        difficulty: 難易度（easy, intermediate, hard）

    Returns:
        クイズ問題のリスト
    """
    # ADK経由ではJSON文字列、直接呼び出しではlistが渡される
    if isinstance(concepts, str):
        try:
            concepts = json.loads(concepts)
        except (json.JSONDecodeError, TypeError):
            concepts = []
    if not concepts:
        return {
            "questions": [],
            "message": "クイズを生成するには概念を登録してください",
        }

    client = _get_genai_client()

    if client is None:
        # モック応答
        questions = []
        for i, concept in enumerate(concepts[:num_questions]):
            questions.append({
                "id": i + 1,
                "question": f"「{concept['name']}」とは何ですか？",
                "type": "multiple_choice",
                "options": [
                    concept.get("definition", "定義"),
                    "誤った選択肢A",
                    "誤った選択肢B",
                    "誤った選択肢C",
                ],
                "correct_index": 0,
                "explanation": f"{concept['name']}は{concept.get('definition', '')}です。",
            })
        return {"questions": questions}

    concepts_text = "\n".join(
        f"- {c['name']}: {c.get('definition', '')}" for c in concepts[:10]
    )

    difficulty_prompts = {
        "easy": "基本的な理解を確認する簡単な",
        "intermediate": "概念の正しい理解を確認する標準的な",
        "hard": "深い理解と応用力を確認する難しい",
    }

    prompt = f"""以下の概念に基づいて、{difficulty_prompts.get(difficulty, difficulty_prompts["intermediate"])}クイズを{num_questions}問生成してください。

概念:
{concepts_text}

各問題には4つの選択肢を用意し、1つだけが正解となるようにしてください。
問題タイプは「multiple_choice」（選択問題）と「true_false」（○×問題）を混ぜてください。

JSON形式で出力:
{{
  "questions": [
    {{
      "id": 1,
      "question": "質問文",
      "type": "multiple_choice",
      "options": ["選択肢A", "選択肢B", "選択肢C", "選択肢D"],
      "correct_index": 0,
      "explanation": "なぜこれが正解なのかの説明"
    }}
  ]
}}"""

    try:
        text = _call_with_retry(
            client,
            model="gemini-2.0-flash",
            contents=[{"role": "user", "parts": [{"text": prompt}]}],
            config={"response_mime_type": "application/json"},
        )
        return json.loads(text)
    except Exception as e:
        return {
            "questions": [],
            "error": str(e),
        }


def generate_learning_path(
    goal: str,
    available_concepts: str,
) -> dict[str, Any]:
    """学習目標に基づいて学習パスを生成する

    Args:
        goal: 学習目標
        available_concepts: 利用可能な概念リストのJSON文字列。例: [{"name": "概念名", "definition": "定義"}]

    Returns:
        学習パス（順序付けられた概念のリスト）
    """
    # ADK経由ではJSON文字列、直接呼び出しではlistが渡される
    if isinstance(available_concepts, str):
        try:
            available_concepts = json.loads(available_concepts)
        except (json.JSONDecodeError, TypeError):
            available_concepts = []
    client = _get_genai_client()

    if not available_concepts:
        return {
            "learning_path": [],
            "message": "学習パスを生成するには概念を登録してください",
        }

    if client is None:
        return {
            "goal": goal,
            "learning_path": [
                {"concept": c["name"], "reason": "基礎概念", "estimated_time": "30分"}
                for c in available_concepts[:5]
            ],
            "total_steps": min(5, len(available_concepts)),
        }

    concepts_text = "\n".join(
        f"- {c['name']}: {c.get('definition', '')}" for c in available_concepts[:20]
    )

    prompt = f"""学習目標: {goal}

利用可能な概念:
{concepts_text}

上記の概念を使って、学習目標を達成するための最適な学習パスを生成してください。
概念間の依存関係を考慮し、基礎から応用への順序で並べてください。

JSON形式で出力:
{{
  "goal": "学習目標の要約",
  "learning_path": [
    {{
      "step": 1,
      "concept": "概念名",
      "reason": "この概念を学ぶ理由",
      "prerequisites": ["前提となる概念"],
      "estimated_time": "推定学習時間"
    }}
  ],
  "total_steps": 5,
  "tips": "学習を成功させるためのヒント"
}}"""

    try:
        text = _call_with_retry(
            client,
            model="gemini-2.0-flash",
            contents=[{"role": "user", "parts": [{"text": prompt}]}],
            config={"response_mime_type": "application/json"},
        )
        return json.loads(text)
    except Exception as e:
        return {
            "learning_path": [],
            "error": str(e),
        }


def suggest_related_papers(
    concept_names: list[str],
    limit: int = 5,
) -> dict[str, Any]:
    """関連論文を提案する

    Args:
        concept_names: 関連する概念名のリスト
        limit: 提案する論文の最大数

    Returns:
        関連論文の提案リスト（検索キーワードと学術データベースへのリンク）
    """
    client = _get_genai_client()

    if not concept_names:
        return {
            "suggestions": [],
            "message": "関連論文を探すには概念を指定してください",
        }

    if client is None:
        return {
            "search_queries": [" AND ".join(concept_names[:3])],
            "suggestions": [
                {
                    "title": f"{concept_names[0]}に関する論文",
                    "search_url": f"https://scholar.google.com/scholar?q={'+'.join(concept_names[:2])}",
                }
            ],
        }

    concepts_text = ", ".join(concept_names)

    prompt = f"""以下の概念に関連する論文を探すための検索クエリと、学習に役立つ論文の特徴を提案してください。

概念: {concepts_text}

JSON形式で出力:
{{
  "search_queries": ["学術論文検索に使えるクエリ1", "クエリ2"],
  "suggested_topics": [
    {{
      "topic": "探すべきトピック",
      "reason": "なぜこのトピックが重要か",
      "keywords": ["検索キーワード"]
    }}
  ],
  "databases": [
    {{
      "name": "Google Scholar",
      "url": "https://scholar.google.com",
      "search_tip": "このデータベースでの検索のコツ"
    }}
  ]
}}"""

    try:
        text = _call_with_retry(
            client,
            model="gemini-2.0-flash",
            contents=[{"role": "user", "parts": [{"text": prompt}]}],
            config={"response_mime_type": "application/json"},
        )
        return json.loads(text)
    except Exception as e:
        return {
            "suggestions": [],
            "error": str(e),
        }
