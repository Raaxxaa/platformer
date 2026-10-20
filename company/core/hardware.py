"""Looks at this machine's GPU / memory and picks Ollama models that will actually fit."""
from __future__ import annotations

import platform
import shutil
import subprocess


def _run(args: list[str]) -> str:
    try:
        return subprocess.run(args, capture_output=True, text=True, timeout=10).stdout
    except (OSError, subprocess.TimeoutExpired):
        return ""


def model_memory_gb() -> tuple[float, str]:
    """GB a model can use, and how that was found."""
    if shutil.which("nvidia-smi"):
        out = _run(["nvidia-smi", "--query-gpu=memory.total", "--format=csv,noheader,nounits"])
        mibs = [int(x) for x in out.split() if x.strip().isdigit()]
        if mibs:
            return max(mibs) / 1024, f"NVIDIA GPU, {max(mibs) / 1024:.0f} GB VRAM"
    if platform.system() == "Darwin":
        out = _run(["sysctl", "-n", "hw.memsize"]).strip()
        if out.isdigit():
            total = int(out) / 1024 ** 3
            # macOS lets the GPU use about 75% of unified memory.
            return total * 0.75, f"Apple Silicon, {total:.0f} GB unified memory"
    if shutil.which("rocm-smi"):
        out = _run(["rocm-smi", "--showmeminfo", "vram", "--csv"])
        nums = [int(x) for x in out.replace(",", " ").split() if x.isdigit()]
        if nums:
            return max(nums) / 1024 ** 3, "AMD GPU"
    return 0.0, "no supported GPU found (models would run on the CPU: very slow)"


# (minimum GB, coder, planner, summary, context window, note)
TIERS = [
    (40, "qwen3-coder:30b", "qwen3-coder:30b", "qwen2.5-coder:7b", 65536,
     "Big GPU: the strongest local coder, with room for a long context."),
    (22, "qwen3-coder:30b", "qwen3-coder:30b", "qwen2.5-coder:7b", 32768,
     "24 GB class GPU: Qwen3-Coder 30B (a fast mixture-of-experts model) fits with a 32k context."),
    (14, "qwen2.5-coder:14b", "qwen2.5-coder:14b", "qwen2.5-coder:7b", 32768,
     "16 GB class GPU: Qwen2.5-Coder 14B. Good at small, well-defined tasks."),
    (8, "qwen2.5-coder:7b", "qwen2.5-coder:7b", "qwen2.5-coder:7b", 16384,
     "8–12 GB GPU: only a 7B model fits. Expect it to handle only tiny tasks; the head will fix more."),
]


def recommend(gb: float) -> dict:
    for min_gb, coder, planner, summary, ctx, note in TIERS:
        if gb >= min_gb:
            return {"coder": coder, "planner": planner, "summary": summary, "num_ctx": ctx, "note": note}
    return {"coder": "qwen2.5-coder:7b", "planner": "qwen2.5-coder:7b", "summary": "qwen2.5-coder:7b",
            "num_ctx": 8192,
            "note": "Under 8 GB for models: local workers will be too slow or too weak to be worth it. "
                    "Consider running the head alone."}
