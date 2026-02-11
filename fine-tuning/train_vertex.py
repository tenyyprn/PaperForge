"""Vertex AI上でのGemma 2ファインチューニング

Google Cloud Vertex AIを使用してクラウド上でトレーニングを実行する
"""

import os
from pathlib import Path

from google.cloud import aiplatform


def submit_training_job(
    project_id: str,
    region: str = "us-central1",
    staging_bucket: str | None = None,
):
    """Vertex AIにトレーニングジョブを送信"""

    # Vertex AI初期化
    aiplatform.init(
        project=project_id,
        location=region,
        staging_bucket=staging_bucket,
    )

    # カスタムトレーニングジョブの設定
    job = aiplatform.CustomTrainingJob(
        display_name="gemma2-lora-scierc-finetuning",
        script_path="train_lora.py",
        container_uri="us-docker.pkg.dev/vertex-ai/training/pytorch-gpu.2-1.py310:latest",
        requirements=["peft>=0.7.0", "trl>=0.7.0", "bitsandbytes>=0.41.0"],
    )

    # トレーニング実行
    model = job.run(
        machine_type="n1-standard-8",
        accelerator_type="NVIDIA_TESLA_T4",
        accelerator_count=1,
        replica_count=1,
    )

    return model


def main():
    project_id = os.getenv("GOOGLE_CLOUD_PROJECT")
    if not project_id:
        print("Error: GOOGLE_CLOUD_PROJECT environment variable not set")
        return

    staging_bucket = os.getenv("GCS_STAGING_BUCKET")

    print(f"Submitting training job to Vertex AI...")
    print(f"Project: {project_id}")

    model = submit_training_job(
        project_id=project_id,
        staging_bucket=staging_bucket,
    )

    print(f"Training complete! Model: {model.resource_name}")


if __name__ == "__main__":
    main()
