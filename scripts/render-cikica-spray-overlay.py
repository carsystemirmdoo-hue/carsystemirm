#!/usr/bin/env python3
"""
Prvi funkcionalni compositing test: Cikica (frame-by-frame PNG sekvenca)
preko postojeceg spray-reveal-story.mp4, bez diranja produkcionog koda.

Pipeline (nema Remotion u projektu, ima FFmpeg - koristimo taj obrazac):
  1. Ucitaj assets/cikica-spray/cikica-spray-config.json
  2. Generisi privremenu transparentnu PNG sekvencu (1080x1920, 60fps,
     isti broj frejmova kao original) - Cikica pozicioniran/skaliran/
     fade in-out po config-u, van [startFrame,endFrame] su prazni frejmovi.
  3. FFmpeg overlay preko originalnog MP4 -> H.264/yuv420p, bez zvuka.

Original video se NE modifikuje niti se prepravlja njegov spray reveal -
Cikica je cist foreground overlay.

Pokretanje:
  python3 scripts/render-cikica-spray-overlay.py
  python3 scripts/render-cikica-spray-overlay.py --keep-frames   # zadrzi PNG sekvencu za debug
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image

PROJECT_ROOT = Path(__file__).resolve().parent.parent
ASSET_DIR = PROJECT_ROOT / "assets" / "cikica-spray"
CONFIG_PATH = ASSET_DIR / "cikica-spray-config.json"
OUTPUT_DIR = ASSET_DIR / "output"


def load_config() -> dict:
    return json.loads(CONFIG_PATH.read_text())


def load_scaled_poses(config: dict) -> dict[int, Image.Image]:
    source_dir = PROJECT_ROOT / config["character"]["sourceDir"]
    scale = config["position"]["scale"]
    corrections = config.get("frameCorrections", {})
    poses = {}
    for i in range(1, config["character"]["frameCount"] + 1):
        img = Image.open(source_dir / f"frame-0{i}.png").convert("RGBA")
        w, h = img.size
        scaled = img.resize((round(w * scale), round(h * scale)), Image.LANCZOS)
        poses[i] = scaled
    return poses


def pose_for_line_progress(frame: int, line: dict) -> int:
    """Striktno sekvencijalno mapiranje 1->8 na napredak JEDNE linije.

    progress = (F - startFrame) / (endFrame - startFrame), poza = 1..8.
    Linija MORA prikazati svih 8 poza redom - nema reorder-a, nema loop-a.
    """
    s, e = line["startFrame"], line["endFrame"]
    if e <= s:
        return 1
    progress = (frame - s) / (e - s)
    progress = max(0.0, min(1.0, progress))
    pose = int(progress * 8) + 1
    return min(8, pose)


def build_timeline(config: dict) -> tuple[dict[int, int], dict[int, float]]:
    """Vraca (pose_by_frame, opacity_by_frame) za frejmove [startFrame, endFrame].

    Svaka linija iz config["lines"] prikazuje pozе 1->8 STROGO REDOM, mapirano
    na njen sopstveni progres (videti pose_for_line_progress). Izmedju linija
    (i posle poslednje) ruka drzi poslednju prikazanu pozu (8, cim se linija
    zavrsi) - reset na pozu 1 se desava tacno na startFrame sledece linije.
    Pre prve linije drzi se poza 1 (mirno/pocetno stanje).
    """
    lines = config["lines"]
    start_frame = config["startFrame"]
    end_frame = config["endFrame"]
    fade_in = config["fadeInFrames"]
    fade_out = config["fadeOutFrames"]

    pose_by_frame: dict[int, int] = {}
    last_pose = 1
    for f in range(start_frame, end_frame + 1):
        # da li smo unutar neke linije trenutno?
        current_line = None
        for line in lines:
            if line["startFrame"] <= f <= line["endFrame"]:
                current_line = line
                break
        if current_line is not None:
            pose = pose_for_line_progress(f, current_line)
            last_pose = pose
        else:
            pose = last_pose
        pose_by_frame[f] = pose

    opacity_by_frame: dict[int, float] = {}
    for f in range(start_frame, end_frame + 1):
        if f < start_frame + fade_in:
            a = (f - start_frame + 1) / fade_in
        elif f > end_frame - fade_out:
            a = (end_frame - f) / fade_out
        else:
            a = 1.0
        opacity_by_frame[f] = max(0.0, min(1.0, a))

    return pose_by_frame, opacity_by_frame


def composite_frame(
    canvas_size: tuple[int, int],
    pose_img: Image.Image | None,
    opacity: float,
    x: int,
    y: int,
) -> Image.Image:
    canvas = Image.new("RGBA", canvas_size, (0, 0, 0, 0))
    if pose_img is None or opacity <= 0:
        return canvas

    if opacity < 1.0:
        arr = np.array(pose_img)
        arr = arr.copy()
        arr[:, :, 3] = (arr[:, :, 3].astype(np.float32) * opacity).astype(np.uint8)
        pose_img = Image.fromarray(arr)

    canvas.paste(pose_img, (x, y), pose_img)
    return canvas


def generate_overlay_sequence(config: dict, frames_dir: Path) -> None:
    total_frames = config["video"]["totalFrames"]
    canvas_size = (config["video"]["width"], config["video"]["height"])
    base_x = config["position"]["x"]
    base_y = config["position"]["y"]
    corrections = config.get("frameCorrections", {})

    poses = load_scaled_poses(config)
    pose_by_frame, opacity_by_frame = build_timeline(config)

    empty_canvas = Image.new("RGBA", canvas_size, (0, 0, 0, 0))

    for frame_idx in range(total_frames):
        if frame_idx in pose_by_frame:
            pose_num = pose_by_frame[frame_idx]
            opacity = opacity_by_frame[frame_idx]
            corr = corrections.get(str(pose_num), {"dx": 0, "dy": 0})
            img = composite_frame(
                canvas_size,
                poses[pose_num],
                opacity,
                base_x + corr.get("dx", 0),
                base_y + corr.get("dy", 0),
            )
        else:
            img = empty_canvas
        img.save(frames_dir / f"frame-{frame_idx:06d}.png")

    print(f"✔ generisano {total_frames} overlay frejmova u {frames_dir}")


def run_ffmpeg(config: dict, frames_dir: Path, output_path: Path) -> None:
    input_video = PROJECT_ROOT / config["video"]["input"]
    fps = config["video"]["fps"]

    cmd = [
        "ffmpeg", "-y",
        "-i", str(input_video),
        "-start_number", "0",
        "-framerate", str(fps),
        "-i", str(frames_dir / "frame-%06d.png"),
        "-filter_complex", "[0:v][1:v]overlay=0:0:format=auto",
        "-c:v", "libx264",
        "-preset", "slow",
        "-crf", "17",
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        "-an",
        str(output_path),
    ]
    print("▸ FFmpeg overlay:", " ".join(cmd))
    subprocess.run(cmd, check=True, cwd=PROJECT_ROOT)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--keep-frames", action="store_true", help="zadrzi privremenu PNG sekvencu")
    parser.add_argument("--output", default=None, help="izlazna putanja MP4 (default: assets/cikica-spray/output/spray-reveal-story-cikica-test.mp4)")
    args = parser.parse_args()

    if not CONFIG_PATH.exists():
        print(f"Nedostaje config: {CONFIG_PATH}", file=sys.stderr)
        sys.exit(1)

    config = load_config()
    input_video = PROJECT_ROOT / config["video"]["input"]
    if not input_video.exists():
        print(f"Nedostaje ulazni video: {input_video}", file=sys.stderr)
        sys.exit(1)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    output_path = Path(args.output) if args.output else OUTPUT_DIR / "spray-reveal-story-cikica-test.mp4"

    if args.keep_frames:
        frames_dir = OUTPUT_DIR / "_overlay-frames-debug"
        frames_dir.mkdir(parents=True, exist_ok=True)
    else:
        frames_dir = Path(tempfile.mkdtemp(prefix="cikica-overlay-"))

    try:
        generate_overlay_sequence(config, frames_dir)
        run_ffmpeg(config, frames_dir, output_path)
        print(f"\n✔ Renderovano: {output_path}")
    finally:
        if not args.keep_frames:
            shutil.rmtree(frames_dir, ignore_errors=True)


if __name__ == "__main__":
    main()
