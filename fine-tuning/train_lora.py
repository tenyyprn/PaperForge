"""Gemma 2 LoRAファインチューニングスクリプト

SciERCデータセットを使用して概念抽出タスクのファインチューニングを行う
"""

import json
import os
from pathlib import Path

import torch
from datasets import Dataset
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    BitsAndBytesConfig,
    TrainingArguments,
)
from trl import SFTTrainer


def load_dataset(data_path: Path) -> Dataset:
    """Alpaca形式のJSONデータをHugging Face Datasetに変換"""
    with open(data_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Alpaca形式のプロンプトテンプレート
    formatted_data = []
    for item in data:
        text = f"""### Instruction:
{item['instruction']}

### Input:
{item['input']}

### Response:
{item['output']}"""
        formatted_data.append({"text": text})

    return Dataset.from_list(formatted_data)


def main():
    # 設定
    model_name = "google/gemma-2-2b"  # 2Bモデル（ローカルGPU向け）
    output_dir = Path(__file__).parent / "output" / "gemma2-lora-scierc"
    data_dir = Path(__file__).parent / "data" / "processed"

    # HuggingFaceトークン（環境変数から）
    hf_token = os.getenv("HF_TOKEN") or os.getenv("HUGGING_FACE_HUB_TOKEN")

    print(f"Loading model: {model_name}")
    print(f"Output directory: {output_dir}")

    # 量子化設定（QLoRA用）
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.bfloat16,
        bnb_4bit_use_double_quant=True,
    )

    # モデルのロード
    model = AutoModelForCausalLM.from_pretrained(
        model_name,
        quantization_config=bnb_config,
        device_map="auto",
        trust_remote_code=True,
        token=hf_token,
    )

    # トークナイザーのロード
    tokenizer = AutoTokenizer.from_pretrained(
        model_name,
        trust_remote_code=True,
        token=hf_token,
    )
    tokenizer.pad_token = tokenizer.eos_token
    tokenizer.padding_side = "right"

    # LoRA設定
    lora_config = LoraConfig(
        r=16,  # LoRAのランク
        lora_alpha=32,  # スケーリング係数
        lora_dropout=0.05,
        bias="none",
        task_type="CAUSAL_LM",
        target_modules=[
            "q_proj",
            "k_proj",
            "v_proj",
            "o_proj",
            "gate_proj",
            "up_proj",
            "down_proj",
        ],
    )

    # モデルをLoRA用に準備
    model = prepare_model_for_kbit_training(model)
    model = get_peft_model(model, lora_config)
    model.print_trainable_parameters()

    # データセットのロード
    train_dataset = load_dataset(data_dir / "train_alpaca.json")
    eval_dataset = load_dataset(data_dir / "eval_alpaca.json")

    print(f"Train samples: {len(train_dataset)}")
    print(f"Eval samples: {len(eval_dataset)}")

    # トレーニング設定
    training_args = TrainingArguments(
        output_dir=str(output_dir),
        num_train_epochs=3,
        per_device_train_batch_size=1,
        per_device_eval_batch_size=1,
        gradient_accumulation_steps=8,
        gradient_checkpointing=True,
        optim="paged_adamw_8bit",
        learning_rate=2e-4,
        weight_decay=0.01,
        fp16=False,
        bf16=True,
        max_grad_norm=0.3,
        warmup_ratio=0.03,
        lr_scheduler_type="cosine",
        logging_steps=10,
        save_strategy="steps",
        save_steps=50,
        eval_strategy="steps",
        eval_steps=50,
        report_to="none",
        push_to_hub=False,
    )

    # トレーナーの設定
    trainer = SFTTrainer(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        eval_dataset=eval_dataset,
        tokenizer=tokenizer,
        max_seq_length=2048,
        dataset_text_field="text",
        packing=False,
    )

    # トレーニング開始
    print("Starting training...")
    trainer.train()

    # モデルの保存
    print(f"Saving model to {output_dir}")
    trainer.save_model()
    tokenizer.save_pretrained(output_dir)

    print("Training complete!")


if __name__ == "__main__":
    main()
