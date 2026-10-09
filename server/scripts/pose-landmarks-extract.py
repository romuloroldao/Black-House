#!/usr/bin/env python3
"""
Extrai pontos do corpo (MediaPipe Pose Landmarker) de fotos locais para JSONL.

Entrada (stdin): linhas "id<TAB>caminho_absoluto".
Saída: um JSON por linha com id, largura, altura, poses (33 pontos [x, y, z, visibility] cada).

Uso:
  python pose-landmarks-extract.py --model pose_landmarker_lite.task --out landmarks.jsonl < fotos.tsv

Requer Python >= 3.9 e `pip install mediapipe`. As fotos são sensíveis: grave a saída fora de
diretórios servidos pelo Nginx.
"""
import argparse
import json
import sys
import time

import mediapipe as mp
import numpy as np
from mediapipe.tasks.python import BaseOptions
from mediapipe.tasks.python import vision
from PIL import Image, ImageOps


def load_image(path):
    # Aplica a rotação EXIF, como o navegador faz ao desenhar a foto.
    with Image.open(path) as img:
        rgb = ImageOps.exif_transpose(img).convert("RGB")
        return mp.Image(image_format=mp.ImageFormat.SRGB, data=np.asarray(rgb))


def build_landmarker(model_path, num_poses):
    options = vision.PoseLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=model_path),
        running_mode=vision.RunningMode.IMAGE,
        num_poses=num_poses,
        min_pose_detection_confidence=0.5,
        min_pose_presence_confidence=0.5,
    )
    return vision.PoseLandmarker.create_from_options(options)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--num-poses", type=int, default=2)
    args = parser.parse_args()

    landmarker = build_landmarker(args.model, args.num_poses)
    done = 0
    with open(args.out, "w", encoding="utf-8") as out:
        for line in sys.stdin:
            line = line.strip()
            if not line:
                continue
            foto_id, path = line.split("\t", 1)
            record = {"id": foto_id}
            started = time.time()
            try:
                image = load_image(path)
                result = landmarker.detect(image)
                record["width"] = image.width
                record["height"] = image.height
                record["poses"] = [
                    [
                        [round(p.x, 4), round(p.y, 4), round(p.z, 4), round(p.visibility or 0, 3)]
                        for p in pose
                    ]
                    for pose in result.pose_landmarks
                ]
            except Exception as exc:  # noqa: BLE001 - registar e seguir
                record["error"] = str(exc)[:300]
            record["ms"] = int((time.time() - started) * 1000)
            out.write(json.dumps(record) + "\n")
            done += 1
            if done % 100 == 0:
                print(f"{done} fotos", file=sys.stderr, flush=True)
    print(f"total {done}", file=sys.stderr)


if __name__ == "__main__":
    main()
