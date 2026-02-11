"""論文関連のAPIエンドポイント"""

import os
import uuid
import json
import io
import re
from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
from pypdf import PdfReader

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
            # Vertex AI を使用
            project = os.getenv("GOOGLE_CLOUD_PROJECT")
            if project:
                _client = genai.Client(vertexai=True, project=project, location="us-central1")
    return _client


class Concept(BaseModel):
    id: str
    name: str
    name_en: str = ""  # 英語名（原語）
    name_ja: str = ""  # 日本語名（翻訳）
    definition: str
    definition_ja: str = ""  # 日本語定義
    concept_type: str = "concept"  # オントロジータイプ


class Relation(BaseModel):
    id: str
    source: str
    target: str
    relation_type: str


class PaperSummary(BaseModel):
    """論文の要約情報"""
    title: str = ""
    title_en: str = ""  # 英語タイトル（原語）
    title_ja: str = ""  # 日本語タイトル（翻訳）
    authors: list[str] = []
    year: str = ""
    original_language: str = ""  # 原語（en/ja/other）
    abstract: str = ""
    abstract_ja: str = ""  # 日本語要約
    main_claim: str = ""
    main_claim_ja: str = ""  # 日本語主張
    introduction: str = ""
    development: str = ""
    turn: str = ""
    conclusion: str = ""
    easy_explanation: str = ""


class PaperResponse(BaseModel):
    paper_id: str
    filename: str
    status: str
    concepts: list[Concept] = []
    relations: list[Relation] = []
    summary: PaperSummary | None = None


class ExtractionResult(BaseModel):
    paper_id: str
    concepts: list[Concept]
    relations: list[Relation]


EXTRACTION_PROMPT_TEMPLATE = """以下の論文テキストから、オントロジー（知識体系）を構築するための情報を抽出してください。
**重要：英語論文の場合、必ず日本語に翻訳してください。**

## 抽出してほしい情報：
1. 論文のメタ情報（タイトル、著者、発表年）- 英語と日本語の両方
2. 要約と主張 - 日本語で
3. 起承転結の構造 - 日本語で
4. 高校生向けのやさしい説明 - 日本語で
5. **オントロジー情報**：概念をタイプ分類し、意味的な関係を抽出 - 英語名と日本語名の両方

## 概念のタイプ（concept_type）：
- **method**: 手法・アルゴリズム（例：Transformer, Attention機構）
- **model**: モデル・システム（例：GPT, BERT）
- **dataset**: データセット（例：ImageNet, COCO）
- **task**: タスク・問題（例：画像分類, 機械翻訳）
- **metric**: 評価指標（例：精度, F1スコア）
- **domain**: 研究分野（例：自然言語処理, コンピュータビジョン）
- **theory**: 理論・概念（例：情報エントロピー, 確率分布）
- **application**: 応用先（例：医療診断, 自動運転）

## 関係の種類（relation_type）：
- **is-a**: 上位概念-下位概念（継承関係）
- **part-of**: 全体-部分関係
- **uses**: 使用関係（AはBを使う）
- **improves**: 改良関係（AはBを改良）
- **evaluates-on**: 評価関係（AはBで評価される）
- **applied-to**: 適用関係（AはBに適用される）
- **produces**: 生成関係（AはBを生成する）
- **requires**: 前提関係（AはBを必要とする）

## 出力は必ず以下のJSON形式で返してください：
```json
{{
  "summary": {{
    "title": "表示用タイトル（日本語優先）",
    "title_en": "Original English Title",
    "title_ja": "日本語タイトル（翻訳）",
    "authors": ["著者1", "著者2"],
    "year": "発表年（例: 2024）",
    "original_language": "en または ja",
    "abstract": "論文の要約（日本語、2-3文）",
    "abstract_ja": "論文の要約（日本語、2-3文）",
    "main_claim": "この論文が主張したいこと（日本語、1文）",
    "main_claim_ja": "この論文が主張したいこと（日本語、1文）",
    "introduction": "【起】研究の背景と問題提起（日本語）",
    "development": "【承】提案手法や実験の説明（日本語）",
    "turn": "【転】重要な発見や意外な結果（日本語）",
    "conclusion": "【結】結論と今後の展望（日本語）",
    "easy_explanation": "【高校生向け説明】この論文を高校生にもわかるように、身近な例えを使って説明してください（日本語、3-5文）"
  }},
  "concepts": [
    {{
      "name": "表示用名前（日本語優先、英語名も併記可）",
      "name_en": "English Name",
      "name_ja": "日本語名",
      "definition": "概念の定義（日本語、やさしい言葉で）",
      "definition_ja": "概念の定義（日本語、やさしい言葉で）",
      "concept_type": "method/model/dataset/task/metric/domain/theory/application"
    }}
  ],
  "relations": [
    {{"source": "概念名1（表示用名前と一致）", "target": "概念名2（表示用名前と一致）", "relation_type": "is-a/part-of/uses/improves/evaluates-on/applied-to/produces/requires"}}
  ]
}}
```

論文テキスト:
---
{text}
---

JSON形式で出力してください（英語論文は必ず日本語に翻訳）："""


async def extract_concepts_with_gemini(text: str) -> dict:
    """Gemini APIを使って概念を抽出する"""
    client = get_genai_client()
    if client is None:
        print("Warning: Gemini client not configured. Returning mock data.")
        return {
            "concepts": [
                {"name": "サンプル概念", "definition": "これはAPIキーが設定されていない場合のサンプルデータです"}
            ],
            "relations": []
        }

    try:
        print(f"Calling Gemini API with {len(text[:10000])} chars...")
        prompt = EXTRACTION_PROMPT_TEMPLATE.format(text=text[:10000])
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt,
        )
        print(f"Got response: {type(response)}")

        # レスポンスからテキストを取得
        response_text = response.text
        if not response_text:
            print("Warning: Empty response from Gemini")
            return {"concepts": [], "relations": []}

        print(f"Response length: {len(response_text)}")
        print(f"Response preview: {response_text[:500]}")

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

        # 空白をトリム
        clean_text = clean_text.strip()
        print(f"Cleaned text preview: {clean_text[:300]}")

        # JSONパース
        result = json.loads(clean_text)
        print(f"Successfully parsed {len(result.get('concepts', []))} concepts")
        return result

    except json.JSONDecodeError as e:
        print(f"JSON parse error: {e}")
        print(f"Text that failed to parse: {clean_text[:300] if 'clean_text' in dir() else 'N/A'}")
        return {"concepts": [], "relations": []}
    except Exception as e:
        print(f"Gemini API error: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return {"concepts": [], "relations": []}


@router.post("/upload", response_model=PaperResponse)
async def upload_paper(file: UploadFile = File(...)):
    """論文をアップロードして概念を抽出する"""
    if not file.filename:
        raise HTTPException(status_code=400, detail="ファイル名が必要です")

    # ファイル内容を読み取り
    content = await file.read()

    # テキストとしてデコード
    try:
        if file.filename.endswith(".txt"):
            text = content.decode("utf-8")
        elif file.filename.endswith(".pdf"):
            # PDFからテキストを抽出
            try:
                pdf_reader = PdfReader(io.BytesIO(content))
                text_parts = []
                for page in pdf_reader.pages:
                    page_text = page.extract_text()
                    if page_text:
                        text_parts.append(page_text)
                text = "\n\n".join(text_parts)
                if not text.strip():
                    text = f"[PDF file: {file.filename}] - テキストを抽出できませんでした"
            except Exception as pdf_error:
                print(f"PDF parsing error: {pdf_error}")
                text = f"[PDF file: {file.filename}] - PDF解析エラー: {pdf_error}"
        else:
            text = content.decode("utf-8", errors="ignore")
    except Exception:
        text = content.decode("utf-8", errors="ignore")

    # Gemini APIで概念抽出
    paper_id = str(uuid.uuid4())
    extraction = await extract_concepts_with_gemini(text)

    # 結果を整形
    concepts = [
        Concept(
            id=str(uuid.uuid4()),
            name=c.get("name", ""),
            name_en=c.get("name_en", ""),
            name_ja=c.get("name_ja", ""),
            definition=c.get("definition", ""),
            definition_ja=c.get("definition_ja", c.get("definition", "")),
            concept_type=c.get("concept_type", "concept"),
        )
        for c in extraction.get("concepts", [])
    ]

    relations = [
        Relation(
            id=str(uuid.uuid4()),
            source=r.get("source", ""),
            target=r.get("target", ""),
            relation_type=r.get("relation_type", "related-to"),
        )
        for r in extraction.get("relations", [])
    ]

    # 要約情報を整形
    summary_data = extraction.get("summary", {})
    summary = PaperSummary(
        title=summary_data.get("title", ""),
        title_en=summary_data.get("title_en", ""),
        title_ja=summary_data.get("title_ja", ""),
        authors=summary_data.get("authors", []),
        year=summary_data.get("year", ""),
        original_language=summary_data.get("original_language", ""),
        abstract=summary_data.get("abstract", ""),
        abstract_ja=summary_data.get("abstract_ja", summary_data.get("abstract", "")),
        main_claim=summary_data.get("main_claim", ""),
        main_claim_ja=summary_data.get("main_claim_ja", summary_data.get("main_claim", "")),
        introduction=summary_data.get("introduction", ""),
        development=summary_data.get("development", ""),
        turn=summary_data.get("turn", ""),
        conclusion=summary_data.get("conclusion", ""),
        easy_explanation=summary_data.get("easy_explanation", ""),
    ) if summary_data else None

    return PaperResponse(
        paper_id=paper_id,
        filename=file.filename,
        status="extracted",
        concepts=concepts,
        relations=relations,
        summary=summary,
    )


@router.get("/{paper_id}", response_model=PaperResponse)
async def get_paper(paper_id: str):
    """論文の情報を取得する"""
    # TODO: Firestoreから論文情報を取得
    raise HTTPException(status_code=404, detail="論文が見つかりません")


@router.get("/{paper_id}/extraction", response_model=ExtractionResult)
async def get_extraction(paper_id: str):
    """論文から抽出された概念と関係性を取得する"""
    # TODO: 抽出結果を取得
    raise HTTPException(status_code=404, detail="抽出結果が見つかりません")
