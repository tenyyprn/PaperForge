# Gemma 2 + LoRA ファインチューニング

論文からの概念抽出に特化したGemma 2モデルのファインチューニング。

## 目的

- 論文テキストから**概念（Concepts）**を抽出
- 概念間の**関係性（Relations）**を抽出
- 構造化されたJSON形式で出力

## データセット構成

```
data/
├── raw/              # 元の論文データ
├── processed/        # 前処理済みデータ
└── annotations/      # アノテーション済みデータ
```

## 学習スクリプト

```bash
# ローカル実行（開発用）
python train.py --config configs/dev.yaml

# Cloud GPU実行（本番用）
python train.py --config configs/prod.yaml
```

## モデル出力

- 概念抽出: `{"concepts": [{"name": "...", "definition": "..."}]}`
- 関係抽出: `{"relations": [{"source": "...", "target": "...", "type": "..."}]}`
