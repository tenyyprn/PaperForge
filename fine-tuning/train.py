"""Gemma 2 + LoRA ファインチューニングスクリプト"""

import argparse
from pathlib import Path

import yaml


def load_config(config_path: str) -> dict:
    """設定ファイルを読み込む"""
    with open(config_path) as f:
        return yaml.safe_load(f)


def main():
    parser = argparse.ArgumentParser(description="Gemma 2 LoRA Fine-tuning")
    parser.add_argument(
        "--config",
        type=str,
        default="configs/dev.yaml",
        help="設定ファイルのパス",
    )
    args = parser.parse_args()

    config = load_config(args.config)
    print(f"Config loaded: {config}")

    # TODO: 以下を実装
    # 1. モデルの読み込み（QLoRA）
    # 2. データセットの読み込み
    # 3. LoRAアダプターの設定
    # 4. トレーニングの実行
    # 5. モデルの保存

    print("Training script is not yet implemented.")
    print("Please implement the training logic.")


if __name__ == "__main__":
    main()
