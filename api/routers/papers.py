"""論文関連のAPIエンドポイント"""

from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel

router = APIRouter()


class PaperResponse(BaseModel):
    paper_id: str
    filename: str
    status: str


class ExtractionResult(BaseModel):
    paper_id: str
    concepts: list[dict]
    relations: list[dict]


@router.post("/upload", response_model=PaperResponse)
async def upload_paper(file: UploadFile = File(...)):
    """論文をアップロードする"""
    if not file.filename:
        raise HTTPException(status_code=400, detail="ファイル名が必要です")

    # TODO: ファイル保存処理を実装
    # TODO: extraction_agentを呼び出して概念抽出を開始

    return PaperResponse(
        paper_id="placeholder",
        filename=file.filename,
        status="uploaded",
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
