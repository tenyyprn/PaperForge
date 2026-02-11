"""学習パス生成のAPIエンドポイント"""

import json
import os
import time
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

# Gemini クライアント（遅延初期化）
_client = None


def get_genai_client():
    """Geminiクライアントを取得（遅延初期化）"""
    global _client
    if _client is None:
        from google import genai
        api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
        if api_key:
            _client = genai.Client(api_key=api_key)
        else:
            project = os.getenv("GOOGLE_CLOUD_PROJECT")
            if project:
                _client = genai.Client(vertexai=True, project=project, location="us-central1")
    return _client


class Concept(BaseModel):
    id: str
    name: str
    definition: str


class Relation(BaseModel):
    id: str
    source: str
    target: str
    relation_type: str


class LearningPathRequest(BaseModel):
    concepts: list[Concept]
    relations: list[Relation] = []


class LearningStep(BaseModel):
    order: int
    concept_id: str
    concept_name: str
    reason: str
    prerequisites: list[str] = []


class LearningPathResponse(BaseModel):
    steps: list[LearningStep]
    summary: str


SYSTEM_PROMPT = """あなたは学習カリキュラム設計の専門家です。
与えられた概念リストと関係性から、最適な学習順序を提案してください。

以下のルールに従ってください：
1. 基礎的な概念から応用的な概念へと進む順序を提案する
2. 前提知識が必要な概念は、その前提を先に学ぶよう順序付ける
3. 関連する概念はなるべく近い順序で学べるようにする
4. 各ステップに学習理由を簡潔に説明する

出力はJSON形式で返してください：
{
  "steps": [
    {
      "order": 1,
      "concept_id": "概念ID",
      "concept_name": "概念名",
      "reason": "この順序で学ぶ理由",
      "prerequisites": ["前提となる概念名のリスト"]
    }
  ],
  "summary": "学習パス全体の説明（2-3文）"
}
"""


@router.post("/generate", response_model=LearningPathResponse)
async def generate_learning_path(request: LearningPathRequest):
    """概念から最適な学習パスを生成"""
    client = get_genai_client()

    if not request.concepts:
        return LearningPathResponse(
            steps=[],
            summary="概念が登録されていません。論文をアップロードして概念を抽出してください。"
        )

    if client is None:
        # APIキーがない場合は概念順にモック応答
        steps = [
            LearningStep(
                order=i + 1,
                concept_id=c.id,
                concept_name=c.name,
                reason="基礎から順番に学習",
                prerequisites=[]
            )
            for i, c in enumerate(request.concepts)
        ]
        return LearningPathResponse(
            steps=steps,
            summary="Gemini APIキーが設定されていないため、登録順で表示しています。"
        )

    # 概念と関係性を文字列に変換
    concepts_text = "\n".join(
        f"- ID: {c.id}, 名前: {c.name}, 定義: {c.definition}"
        for c in request.concepts
    )

    relations_text = ""
    if request.relations:
        relations_text = "\n関係性:\n" + "\n".join(
            f"- {r.source} --[{r.relation_type}]--> {r.target}"
            for r in request.relations
        )

    user_prompt = f"""以下の概念から最適な学習順序を提案してください。

概念リスト:
{concepts_text}
{relations_text}

JSON形式で回答してください。"""

    try:
        # リトライ付きAPI呼び出し
        response_text = None
        for attempt in range(3):
            try:
                response = client.models.generate_content(
                    model="gemini-2.0-flash",
                    contents=[{"role": "user", "parts": [{"text": user_prompt}]}],
                    config={
                        "system_instruction": SYSTEM_PROMPT,
                        "response_mime_type": "application/json",
                    },
                )
                response_text = response.text
                break
            except Exception as retry_e:
                if ("429" in str(retry_e) or "RESOURCE_EXHAUSTED" in str(retry_e)) and attempt < 2:
                    time.sleep(2 ** attempt)
                    continue
                raise

        # JSONをパース
        result = json.loads(response_text)

        steps = [
            LearningStep(
                order=s.get("order", i + 1),
                concept_id=s.get("concept_id", ""),
                concept_name=s.get("concept_name", ""),
                reason=s.get("reason", ""),
                prerequisites=s.get("prerequisites", [])
            )
            for i, s in enumerate(result.get("steps", []))
        ]

        return LearningPathResponse(
            steps=steps,
            summary=result.get("summary", "学習パスを生成しました。")
        )

    except Exception as e:
        error_str = str(e)
        # エラー時は概念順に返す
        steps = [
            LearningStep(
                order=i + 1,
                concept_id=c.id,
                concept_name=c.name,
                reason="順番に学習",
                prerequisites=[]
            )
            for i, c in enumerate(request.concepts)
        ]
        if "429" in error_str or "RESOURCE_EXHAUSTED" in error_str:
            summary = "APIのレート制限に達しました。少し時間を置いてから再生成してください。（登録順で仮表示中）"
        else:
            summary = f"学習パス生成中にエラーが発生しました: {error_str}"
        return LearningPathResponse(
            steps=steps,
            summary=summary
        )
