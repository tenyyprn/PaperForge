"""SciERCデータセットをファインチューニング用フォーマットに変換

SciERCのJSON形式から、Gemma 2用のinstruction-output形式に変換する
"""

import json
from pathlib import Path


# エンティティタイプの日本語マッピング
ENTITY_TYPES = {
    "Task": "タスク・課題",
    "Method": "手法・アルゴリズム",
    "Metric": "評価指標",
    "Material": "データ・資料",
    "OtherScientificTerm": "専門用語",
    "Generic": "一般概念",
}

# 関係タイプの日本語マッピング
RELATION_TYPES = {
    "USED-FOR": "に使用される",
    "FEATURE-OF": "の特徴",
    "HYPONYM-OF": "の下位概念",
    "PART-OF": "の一部",
    "COMPARE": "と比較",
    "CONJUNCTION": "と関連",
    "EVALUATE-FOR": "の評価に使用",
}


def extract_span_text(sentences: list[list[str]], start: int, end: int) -> str:
    """文のリストからスパンのテキストを抽出"""
    flat_tokens = []
    for sent in sentences:
        flat_tokens.extend(sent)
    return " ".join(flat_tokens[start : end + 1])


def convert_document(doc: dict) -> dict | None:
    """1つのドキュメントをinstruction-output形式に変換"""
    sentences = doc.get("sentences", [])
    ner_annotations = doc.get("ner", [])
    relation_annotations = doc.get("relations", [])

    if not sentences:
        return None

    # 全文を結合
    full_text = " ".join(" ".join(sent) for sent in sentences)

    # エンティティを抽出
    entities = []
    flat_tokens = []
    for sent in sentences:
        flat_tokens.extend(sent)

    for sent_ner in ner_annotations:
        for ner in sent_ner:
            start, end, entity_type = ner
            text = " ".join(flat_tokens[start : end + 1])
            entities.append(
                {
                    "name": text,
                    "type": ENTITY_TYPES.get(entity_type, entity_type),
                    "start": start,
                    "end": end,
                }
            )

    # 関係を抽出
    relations = []
    for sent_rel in relation_annotations:
        for rel in sent_rel:
            src_start, src_end, tgt_start, tgt_end, rel_type = rel
            src_text = " ".join(flat_tokens[src_start : src_end + 1])
            tgt_text = " ".join(flat_tokens[tgt_start : tgt_end + 1])
            relations.append(
                {
                    "source": src_text,
                    "target": tgt_text,
                    "relation": RELATION_TYPES.get(rel_type, rel_type),
                }
            )

    if not entities:
        return None

    # 出力フォーマットを構築
    output = {"concepts": [], "relations": []}

    for entity in entities:
        output["concepts"].append(
            {"name": entity["name"], "type": entity["type"], "definition": ""}
        )

    for rel in relations:
        output["relations"].append(
            {
                "source": rel["source"],
                "target": rel["target"],
                "relation_type": rel["relation"],
            }
        )

    return {
        "instruction": "以下の論文テキストから、重要な概念（専門用語、手法、タスクなど）とそれらの関係性を抽出してください。",
        "input": full_text,
        "output": json.dumps(output, ensure_ascii=False, indent=2),
    }


def convert_file(input_path: Path, output_path: Path) -> int:
    """JSONファイルを変換"""
    converted = []

    with open(input_path, "r", encoding="utf-8") as f:
        for line in f:
            doc = json.loads(line.strip())
            result = convert_document(doc)
            if result:
                converted.append(result)

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(converted, f, ensure_ascii=False, indent=2)

    return len(converted)


def main():
    """メイン処理"""
    base_dir = Path(__file__).parent
    raw_dir = base_dir / "data" / "raw" / "processed_data" / "json"
    processed_dir = base_dir / "data" / "processed"
    processed_dir.mkdir(parents=True, exist_ok=True)

    files = ["train.json", "dev.json", "test.json"]

    for filename in files:
        input_path = raw_dir / filename
        output_path = processed_dir / f"scierc_{filename}"

        if input_path.exists():
            count = convert_file(input_path, output_path)
            print(f"Converted {filename}: {count} examples -> {output_path}")
        else:
            print(f"File not found: {input_path}")

    # Alpaca形式のファインチューニング用データも作成
    train_path = processed_dir / "scierc_train.json"
    if train_path.exists():
        with open(train_path, "r", encoding="utf-8") as f:
            train_data = json.load(f)

        # シャッフルして分割（90% train, 10% eval）
        import random

        random.seed(42)
        random.shuffle(train_data)

        split_idx = int(len(train_data) * 0.9)
        train_split = train_data[:split_idx]
        eval_split = train_data[split_idx:]

        # Alpaca形式で保存
        with open(processed_dir / "train_alpaca.json", "w", encoding="utf-8") as f:
            json.dump(train_split, f, ensure_ascii=False, indent=2)

        with open(processed_dir / "eval_alpaca.json", "w", encoding="utf-8") as f:
            json.dump(eval_split, f, ensure_ascii=False, indent=2)

        print(f"\nAlpaca format: {len(train_split)} train, {len(eval_split)} eval")


if __name__ == "__main__":
    main()
