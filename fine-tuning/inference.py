"""LoRAファインチューニング済みモデルでの推論スクリプト"""

import json
from pathlib import Path

import torch
from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig


def load_model(
    base_model: str = "google/gemma-2-2b",
    lora_path: str | None = None,
):
    """モデルをロード（LoRAアダプタがあれば適用）"""
    # 量子化設定
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.bfloat16,
    )

    # ベースモデルのロード
    model = AutoModelForCausalLM.from_pretrained(
        base_model,
        quantization_config=bnb_config,
        device_map="auto",
        trust_remote_code=True,
    )

    tokenizer = AutoTokenizer.from_pretrained(base_model, trust_remote_code=True)

    # LoRAアダプタがあれば適用
    if lora_path:
        model = PeftModel.from_pretrained(model, lora_path)
        print(f"Loaded LoRA adapter from {lora_path}")

    return model, tokenizer


def extract_concepts(
    model,
    tokenizer,
    text: str,
    max_new_tokens: int = 1024,
) -> dict:
    """テキストから概念を抽出"""
    prompt = f"""### Instruction:
以下の論文テキストから、重要な概念（専門用語、手法、タスクなど）とそれらの関係性を抽出してください。

### Input:
{text}

### Response:
"""

    inputs = tokenizer(prompt, return_tensors="pt").to(model.device)

    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            max_new_tokens=max_new_tokens,
            do_sample=True,
            temperature=0.7,
            top_p=0.9,
            pad_token_id=tokenizer.eos_token_id,
        )

    response = tokenizer.decode(outputs[0], skip_special_tokens=True)

    # レスポンス部分を抽出
    if "### Response:" in response:
        response = response.split("### Response:")[-1].strip()

    # JSONとしてパース
    try:
        result = json.loads(response)
    except json.JSONDecodeError:
        result = {"raw_output": response, "concepts": [], "relations": []}

    return result


def main():
    """デモ実行"""
    lora_path = Path(__file__).parent / "output" / "gemma2-lora-scierc"

    # LoRAモデルがあれば使用、なければベースモデル
    if lora_path.exists():
        print("Loading fine-tuned model...")
        model, tokenizer = load_model(lora_path=str(lora_path))
    else:
        print("LoRA model not found, using base model...")
        model, tokenizer = load_model()

    # テスト入力
    test_text = """
    We propose a novel neural network architecture for natural language processing
    that combines attention mechanisms with recurrent layers. Our model achieves
    state-of-the-art results on several benchmark datasets including GLUE and SQuAD.
    The key innovation is a multi-head self-attention layer that captures long-range
    dependencies more effectively than traditional LSTM networks.
    """

    print("\n=== Input Text ===")
    print(test_text.strip())

    print("\n=== Extracted Concepts ===")
    result = extract_concepts(model, tokenizer, test_text)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
